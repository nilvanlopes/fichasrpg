import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { apiRequest } from "./client.js";

const destination = "https://fichasrpg.nilvanlopes.com/sistemas/vampiro/minha-ficha?tema=claro#notas";
let redirects;
let originalWindow;

beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  redirects = [];
  globalThis.window = {
    location: {
      origin: new URL(destination).origin,
      href: destination,
      replace: url => redirects.push(url),
    },
  };
});

afterEach(() => {
  mock.restoreAll();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete globalThis.window;
});

for (const response of [{ status: 401 }, { type: "opaqueredirect", status: 0 }]) {
  test(`sessão ausente (${response.status}): inicia SSO e preserva caminho, consulta e fragmento`, async () => {
    mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(apiRequest("/api/sheets"), { code: "LOGIN_REQUIRED" });
    assert.equal(redirects.length, 1);
    const login = new URL(redirects[0]);
    assert.equal(login.origin, new URL(destination).origin);
    assert.equal(login.pathname, "/outpost.goauthentik.io/start");
    assert.equal(login.searchParams.get("rd"), destination);
  });
}

test("sessão válida: retorna as fichas sem iniciar login", async () => {
  const sheets = { sheets: [{ id: "personagem" }] };
  mock.method(globalThis, "fetch", async () => Response.json(sheets));
  assert.deepEqual(await apiRequest("/api/sheets"), sheets);
  assert.deepEqual(redirects, []);
});

test("acesso negado não cria um ciclo de redirecionamentos", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ error: "ACCESS_DENIED" }, { status: 403 }));
  await assert.rejects(apiRequest("/api/sheets"), { code: "ACCESS_DENIED" });
  assert.deepEqual(redirects, []);
});

test("erro de cadastro mantém o usuário no formulário", async () => {
  mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  await assert.rejects(apiRequest("/api/signup/manual"), { code: "LOGIN_REQUIRED" });
  assert.deepEqual(redirects, []);
});
