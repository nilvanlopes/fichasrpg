import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";
import express from "express";
import { registerSignupRoutes } from "./signup.js";

const origin = "https://fichasrpg.example.com";
const realFetch = globalThis.fetch;
let server, base, authentikCalls, mockResponse;
before(async () => {
  process.env.AUTHENTIK_BASE_URL = "https://authentik.example.com";
  process.env.AUTHENTIK_API_TOKEN = "test-token";
  process.env.AUTHENTIK_FICHASRPG_APP_URL = origin;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith(base)) return realFetch(url, init);
    authentikCalls.push({ url: new URL(url), ...init });
    return mockResponse(new URL(url), init);
  };
  const app = express();
  app.use(express.json());
  registerSignupRoutes(app, origin);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  globalThis.fetch = realFetch;
  await new Promise(resolve => server.close(resolve));
});
const input = { username: "jogador", email: "Player@Example.com", password: "test-password-123", passwordRepeat: "test-password-123" };
function post(path, body = input, requestOrigin = origin) {
  return fetch(base + path, { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function reset(responder) {
  authentikCalls = [];
  mockResponse = responder || (() => { throw new Error("Unexpected external request"); });
}

test("manual registration is public and never accepts requested permissions or the Foundry flow", async () => {
  reset((url, init) => {
    if (url.pathname === "/api/v3/core/users/") return Response.json({ results: [] });
    assert.equal(url.pathname, "/api/v3/flows/executor/fichasrpg-enrollment/");
    assert.equal(url.search, "");
    if (init.method !== "POST") return Response.json({ component: "ak-stage-prompt" }, {
      headers: { "Set-Cookie": "authentik_csrf=test-csrf; Path=/; Secure" },
    });
    assert.equal(init.headers["x-csrftoken"], "test-csrf");
    assert.equal(init.headers.cookie, "authentik_csrf=test-csrf");
    assert.deepEqual(JSON.parse(init.body), {
      component: "ak-stage-prompt", username: input.username, email: "player@example.com",
      password: input.password, password_repeat: input.passwordRepeat,
    });
    return Response.json({ component: "ak-stage-email" });
  });
  const response = await post("/api/signup/manual", {
    ...input, groups: ["authentik Admins", "foundry-users"], path: "users/admins", flow: "foundry-enrollment",
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "confirmation_sent");
  assert.equal(authentikCalls.filter(call => call.method === "POST").length, 1);
});

test("duplicate email or username cannot change an existing account", async () => {
  for (const existing of [{ username: "other", email: input.email.toLowerCase() }, { username: "JOGADOR", email: "other@example.com" }]) {
    reset(() => Response.json({ results: [existing] }));
    const response = await post("/api/signup/manual");
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, "account_exists");
    assert.ok(authentikCalls.every(call => call.url.pathname === "/api/v3/core/users/"));
  }
});

test("invalid registration and cross-origin requests are rejected before contacting Authentik", async () => {
  reset();
  for (const override of [{ username: ".." }, { username: "a b" }, { email: "bad" }, { password: "short", passwordRepeat: "short" }, { passwordRepeat: "mismatch" }]) {
    assert.equal((await post("/api/signup/manual", { ...input, ...override })).status, 400);
  }
  for (const path of ["/api/signup/manual", "/api/signup/google/start"]) {
    assert.equal((await post(path, input, "https://other.example.com")).status, 403);
  }
  assert.equal(authentikCalls.length, 0);
});

test("registration reports failure unless the flow reaches email confirmation", async () => {
  for (const finalResponse of [{ component: "ak-stage-access-denied" }, { component: "xak-flow-redirect" }, { component: "ak-stage-prompt", response_errors: { email: ["Invalid"] } }]) {
    reset((url, init) => url.pathname === "/api/v3/core/users/" ? Response.json({ results: [] }) :
      Response.json(init.method === "POST" ? finalResponse : { component: "ak-stage-prompt" }));
    const response = await post("/api/signup/manual");
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, "enrollment_flow_failed");
  }
});

test("Google starts native Authentik OAuth without invitation, accepting no user redirect", async () => {
  reset();
  assert.deepEqual(await (await fetch(base + "/api/signup/config")).json(), { googleEnabled: true });
  const response = await post("/api/signup/google/start", { next: "https://attacker.example/" });
  assert.equal(response.status, 200);
  const redirect = new URL((await response.json()).redirectTo);
  assert.equal(redirect.origin, "https://authentik.example.com");
  assert.equal(redirect.pathname, "/if/flow/fichasrpg-google-start/");
  assert.equal(redirect.searchParams.get("next"), `${origin}/fichas`);
  assert.equal(authentikCalls.length, 0);
});
