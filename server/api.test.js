import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "./app.js";
import { createPool, initializeSchema } from "./db.js";
import { seedVampireCatalog } from "./vampireCatalog.js";
import { vampireForm } from "../test/fixtures/vampire.js";
import { parseSheetFile } from "../src/features/sheets/sheetFiles.js";

if (process.env.DB_NAME !== "fichasrpg_test") throw new Error("Use a dedicated fichasrpg_test database");
const origin = "https://fichasrpg.nilvanlopes.com";
const uidA = "a".repeat(64), uidB = "b".repeat(64);
let pool, auth, server, base;
let usernameA = "pyu";
const primarySheets = {};

function page(path, headers = {}) {
  return fetch(base + path, { redirect: "manual", headers });
}

before(async () => {
  pool = await createPool();
  await initializeSchema(pool);
  await initializeSchema(pool);
  await pool.query("TRUNCATE sheets, accounts");
  auth = createServer((req, res) => {
    const cookie = req.headers.cookie;
    assert.equal(req.headers["x-forwarded-host"], "fichasrpg.nilvanlopes.com");
    if (cookie === "session=broken") { res.writeHead(503); return res.end(); }
    if (!["session=A", "session=B", "session=outsider"].includes(cookie)) { res.writeHead(302, { Location: origin }); return res.end(); }
    res.writeHead(200, {
      "X-authentik-uid": cookie === "session=A" ? uidA : uidB,
      "X-authentik-username": cookie === "session=A" ? usernameA : "player-b",
      "X-authentik-groups": cookie === "session=outsider" ? "foundry-users" : "fichasrpg-users",
    });
    res.end();
  }).listen(0, "127.0.0.1");
  await once(auth, "listening");
  server = createApp({ pool, publicOrigin: origin, authUrl: `http://127.0.0.1:${auth.address().port}` }).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (auth) await new Promise(resolve => auth.close(resolve));
  await pool?.end();
});

function get(user = "A", path = primarySheets[user] ? `/api/sheets/${primarySheets[user]}` : "/api/sheets", headers = {}) {
  return fetch(base + path, { headers: { Cookie: `session=${user}`, ...headers } });
}
function put(user, form, revision, overrides = {}) {
  return fetch(base + `/api/sheets/${primarySheets[user]}`, {
    method: "PUT",
    headers: { Cookie: `session=${user}`, Origin: origin, "X-Ficha-Request": "1",
      "X-Ficha-Account": user === "A" ? uidA : uidB, "Content-Type": "application/json", ...overrides },
    body: JSON.stringify({ form, revision }),
  });
}

function writeSheet(user, path, method, body) {
  return fetch(base + path, {
    method,
    headers: { Cookie: `session=${user}`, Origin: origin, "X-Ficha-Request": "1",
      "X-Ficha-Account": user === "A" ? uidA : uidB, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("logout redirects to the Authentik outpost even without an active application session", async () => {
  const response = await fetch(base + "/api/logout?next=https://example.org", { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), new URL("/outpost.goauthentik.io/sign_out",
    process.env.AUTHENTIK_FICHASRPG_APP_URL || "https://fichasrpg.nilvanlopes.com").href);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("forged identity headers cannot authenticate a request", async () => {
  const response = await fetch(base + "/api/sheets", { headers: { "X-authentik-uid": uidA, "X-authentik-username": "pyu" } });
  assert.equal(response.status, 401);
  assert.equal((await pool.query("SELECT count(*) FROM accounts")).rows[0].count, "0");
});
test("first visit lists no sheets for each authenticated account", async () => {
  for (const user of ["A", "B"]) {
    const response = await get(user);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual((await response.json()).sheets, []);
  }
});
test("two accounts save and read independent records", async () => {
  for (const user of ["A", "B"]) {
    const created = await writeSheet(user, "/api/sheets", "POST", {
      system: "mutantes", form: { "nome-personagem": `Personagem ${user}` },
    });
    assert.equal(created.status, 201);
    primarySheets[user] = (await created.json()).sheet.id;
  }
  assert.equal((await (await get("A")).json()).sheet.form["nome-personagem"], "Personagem A");
  assert.equal((await (await get("B")).json()).sheet.form["nome-personagem"], "Personagem B");
});
test("spoofed headers and owner query parameters do not select another account", async () => {
  const data = await (await get("A", `/api/sheets/${primarySheets.A}?owner_uid=${uidB}`, { "X-authentik-uid": uidB, "X-authentik-username": "player-b" })).json();
  assert.equal(data.user.uid, uidA);
  assert.equal(data.sheet.form["nome-personagem"], "Personagem A");
  const response = await fetch(base + `/api/sheets/${primarySheets.A}`, { method: "PUT", headers: {
    Cookie: "session=A", Origin: origin, "X-Ficha-Request": "1", "X-Ficha-Account": uidA, "Content-Type": "application/json",
  }, body: JSON.stringify({ form: {}, revision: 1, owner_uid: uidB }) });
  assert.equal(response.status, 400);
});
test("switching accounts while a tab is open cannot save the old sheet into the new account", async () => {
  const response = await put("B", { "nome-personagem": "Vazamento A" }, 1, { "X-Ficha-Account": uidA });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "ACCOUNT_CHANGED");
  assert.equal((await (await get("B")).json()).sheet.form["nome-personagem"], "Personagem B");
});
test("optimistic concurrency prevents stale tabs from overwriting newer changes", async () => {
  assert.equal((await put("A", { "nome-personagem": "A atualizado" }, 1)).status, 200);
  const response = await put("A", { "nome-personagem": "A antigo" }, 1);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "SHEET_CONFLICT");
  assert.equal((await (await get("A")).json()).sheet.form["nome-personagem"], "A atualizado");
  assert.equal((await put("A", {}, 0)).status, 400);
});
test("cross-origin writes and forms without the application header are rejected", async () => {
  assert.equal((await put("A", {}, 2, { Origin: "https://other.example" })).status, 403);
  assert.equal((await put("A", {}, 2, { Origin: "" })).status, 403);
  assert.equal((await put("A", {}, 2, { "X-Ficha-Request": "" })).status, 403);
});
test("membership in another application group does not grant access", async () => {
  assert.equal((await get("outsider")).status, 403);
  assert.equal((await get("invalid-session")).status, 401);
  assert.equal((await get("broken")).status, 503);
});
test("malformed and oversized sheet data is rejected", async () => {
  for (const form of [[], { invalid: {} }, { invalid: "x".repeat(16001) }, { constructor: "bad" }, { "bad_key": "bad" }]) {
    assert.equal((await put("A", form, 2)).status, 400);
  }
  assert.equal((await put("A", { text: "x".repeat(600000) }, 2)).status, 413);
});
test("clearing a sheet persists an empty object without reseeding it", async () => {
  assert.equal((await put("A", {}, 2)).status, 200);
  const { sheet } = await (await get("A")).json();
  assert.deepEqual(sheet.form, {});
  assert.equal(sheet.revision, 3);
});
test("stable Authentik UID retains data when a username changes", async () => {
  usernameA = "renamed-user";
  const { user, sheet } = await (await get("A")).json();
  assert.equal(user.uid, uidA);
  assert.equal(user.username, "renamed-user");
  assert.equal(sheet.revision, 3);
});
test("schema initialization and API restart preserve persisted data", async () => {
  await new Promise(resolve => server.close(resolve));
  await initializeSchema(pool);
  server = createApp({ pool, publicOrigin: origin, authUrl: `http://127.0.0.1:${auth.address().port}` }).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await get("B")).json()).sheet.form["nome-personagem"], "Personagem B");
});

test("Vampiro persists every field in PostgreSQL, survives reload, and isolates owner and system", async () => {
  const form = vampireForm();
  const created = await writeSheet("A", "/api/sheets", "POST", { system: "vampiro", name: "Vampiro de teste", form });
  assert.equal(created.status, 201);
  const { sheet } = await created.json();
  const path = `/api/sheets/${sheet.id}`;
  assert.equal(sheet.system, "vampiro");
  assert.deepEqual((await (await get("A", path)).json()).sheet.form, form);
  assert.deepEqual((await pool.query("SELECT form FROM sheets WHERE id = $1", [sheet.id])).rows[0].form, form);
  assert.equal((await get("B", path)).status, 404);
  assert.equal((await writeSheet("B", path, "PUT", { form: {}, revision: 1 })).status, 409);

  const updated = { ...form, nome: "Nome revisado", rd230: false, rd300: true, es1: "4", es21: "1", es26: "2",
    anotacoes: "Anotações atualizadas\nCom acentuação", "vampire-theme": "light" };
  assert.equal((await writeSheet("A", path, "PUT", { form: updated, revision: 1 })).status, 200);
  assert.equal((await writeSheet("A", path, "PUT", { form, revision: 1 })).status, 409);
  await initializeSchema(pool);
  const reloaded = (await (await get("A", path)).json()).sheet;
  assert.deepEqual(reloaded.form, updated);
  assert.equal(reloaded.revision, 2);
  assert.equal((await (await get("B")).json()).sheet.form["nome-personagem"], "Personagem B");
  const listed = (await (await get("A", "/api/sheets")).json()).sheets;
  assert.equal(listed.find(item => item.id === sheet.id).system, "vampiro");

  assert.equal((await writeSheet("A", path, "PUT", { form: {}, revision: 2 })).status, 200);
  assert.deepEqual((await (await get("A", path)).json()).sheet.form, {});
});

for (const system of ["mutantes", "vampiro"]) {
  test(`${system}: saving a changed character name updates the stored title and sheet list`, async () => {
    const field = system === "vampiro" ? "nome" : "nome-personagem";
    const created = await writeSheet("A", "/api/sheets", "POST", {
      system, name: "Nome original", form: { [field]: "Nome original", anotacoes: "Preservar notas" },
    });
    assert.equal(created.status, 201);
    const { sheet } = await created.json();
    const form = { ...sheet.form, [field]: "Nome atualizado" };
    const response = await writeSheet("A", `/api/sheets/${sheet.id}`, "PUT", {
      name: "Nome atualizado", form, revision: sheet.revision,
    });
    assert.equal(response.status, 200);
    const reloaded = (await (await get("A", `/api/sheets/${sheet.id}`)).json()).sheet;
    assert.equal(reloaded.name, form[field]);
    assert.deepEqual(reloaded.form, form);
    const listed = (await (await get("A", "/api/sheets")).json()).sheets;
    assert.equal(listed.find(item => item.id === sheet.id).name, form[field]);
    const stored = (await pool.query("SELECT name, form FROM sheets WHERE id = $1", [sheet.id])).rows[0];
    assert.equal(stored.name, form[field]);
    assert.deepEqual(stored.form, form);
  });
}

test("notes belong to each sheet even when both sheets have the same owner", async () => {
  const paths = [];
  for (const name of ["Helena", "Dante"]) {
    const response = await writeSheet("A", "/api/sheets", "POST", {
      system: "vampiro", name, form: { nome: name, anotacoes: `Anotações de ${name}` },
    });
    assert.equal(response.status, 201);
    paths.push(`/api/sheets/${(await response.json()).sheet.id}`);
  }
  assert.notEqual(paths[0], paths[1]);
  assert.equal((await writeSheet("A", paths[0], "PUT", {
    form: { nome: "Helena", anotacoes: "Novas anotações de Helena\nSegunda linha" }, revision: 1,
  })).status, 200);

  const helena = (await (await get("A", paths[0])).json()).sheet;
  const dante = (await (await get("A", paths[1])).json()).sheet;
  assert.equal(helena.form.anotacoes, "Novas anotações de Helena\nSegunda linha");
  assert.equal(dante.form.anotacoes, "Anotações de Dante");
  assert.equal(dante.revision, 1);
  const stored = await pool.query("SELECT id, form->>'anotacoes' AS notes FROM sheets WHERE id = ANY($1::uuid[])",
    [[helena.id, dante.id]]);
  assert.deepEqual(Object.fromEntries(stored.rows.map(row => [row.id, row.notes])), {
    [helena.id]: helena.form.anotacoes, [dante.id]: dante.form.anotacoes,
  });
});

test("Vampiro v1 import creates a separate sheet and persists converted tracks and notes", async () => {
  const first = await writeSheet("A", "/api/sheets", "POST", {
    system: "vampiro", name: "Ficha existente", form: { nome: "Existente", anotacoes: "Preservar" },
  });
  const original = (await first.json()).sheet;
  const imported = parseSheetFile(JSON.stringify([
    { tema: "dark" }, { id: "nome", value: "Personagem anterior" }, { id: "rd1", checked: true },
    { id: "nome", value: "Personagem importado" }, { id: "rd1", checked: false, value: "1" },
    { id: "es21", alt: "2", src: "/img/trilhascheckbox/4.png" },
    { id: "es26", alt: "3", src: "/img/trilhascheckbox/4.png" },
    { id: "anotacoes", value: "Anotações da v1\nSegunda linha" },
  ]), "vampiro");
  const response = await writeSheet("A", "/api/sheets", "POST", imported);
  assert.equal(response.status, 201);
  const { sheet } = await response.json();
  assert.notEqual(sheet.id, original.id);
  const loaded = (await (await get("A", `/api/sheets/${sheet.id}`)).json()).sheet;
  assert.deepEqual(loaded.form, imported.form);
  assert.equal(loaded.form.es21, "4");
  assert.equal(loaded.form.es26, "4");
  assert.equal(loaded.form.rd1, false);
  assert.equal((await (await get("A", `/api/sheets/${original.id}`)).json()).sheet.form.anotacoes, "Preservar");
  assert.deepEqual((await pool.query("SELECT form FROM sheets WHERE id = $1", [sheet.id])).rows[0].form, imported.form);
});

test("Vampiro: catálogo no banco é idempotente, exige sessão e entrega apenas os poderes de cada disciplina", async t => {
  const catalog = { sourceUrl: "https://example.org/catalogo-teste", disciplines: [
    { id: "test-disciplina-a", name: "Disciplina A de teste", powers: [
      { id: "test-poder-cinco", name: "Poder avançado de teste", level: 5 },
      { id: "test-poder-um", name: "Poder inicial de teste", level: 1, description: "Descrição de teste", details: { Custo: "Um ponto" } },
    ] },
    { id: "test-disciplina-b", name: "Disciplina B de teste", powers: [
      { id: "test-outro-poder", name: "Outro poder de teste", level: 2 },
    ] },
  ] };
  t.after(async () => {
    await pool.query("DELETE FROM vampire_discipline_powers WHERE discipline_id = ANY($1::text[])", [["test-disciplina-a", "test-disciplina-b"]]);
    await pool.query("DELETE FROM vampire_disciplines WHERE id = ANY($1::text[])", [["test-disciplina-a", "test-disciplina-b"]]);
  });
  await seedVampireCatalog(pool, catalog);
  await seedVampireCatalog(pool, catalog);
  await initializeSchema(pool);
  const path = "/api/systems/vampiro/disciplines";
  const anonymous = await fetch(base + path);
  assert.equal(anonymous.status, 401);
  assert.equal((await get("outsider", path)).status, 403);
  const response = await get("A", path);
  assert.equal(response.status, 200);
  const { disciplines } = await response.json();
  const first = disciplines.find(item => item.id === "test-disciplina-a");
  assert.equal(first.source_url, catalog.sourceUrl);
  assert.deepEqual(first.powers.map(item => item.level), [1, 5]);
  assert.equal(first.powers[0].description, "Descrição de teste");
  assert.deepEqual(first.powers[0].details, { Custo: "Um ponto" });
  const second = disciplines.find(item => item.id === "test-disciplina-b");
  assert.deepEqual(second.powers.map(item => item.id), ["test-outro-poder"]);
  assert.deepEqual((await (await get("B", path)).json()).disciplines, disciplines);

  const created = await writeSheet("A", "/api/sheets", "POST", { system: "vampiro", form: {
    nd1: first.name, hd11: first.powers[0].name, hd12: first.powers[1].name, rd176: true,
  } });
  assert.equal(created.status, 201);
  const { sheet } = await created.json();
  await initializeSchema(pool);
  assert.deepEqual((await (await get("A", `/api/sheets/${sheet.id}`)).json()).sheet.form, sheet.form);
});

test("Vampiro: métodos e origem das fórmulas alquímicas persistem por linha e sobrevivem a recarga", async () => {
  const form = {
    nd1: "Thin-Blood Alchemy", hd11: "Sense the Unseen", "hd11-distillation": "fixatio",
    "hd11-mimic-discipline": "auspex", "hd11-mimic-power": "auspex--sense-the-unseen",
    hd12: "Haze", "hd12-distillation": "calcinatio", nd2: "Auspex", hd21: "Heightened Senses",
  };
  const created = await writeSheet("A", "/api/sheets", "POST", { system: "vampiro", form });
  assert.equal(created.status, 201);
  const { sheet } = await created.json();
  const path = `/api/sheets/${sheet.id}`;
  assert.deepEqual((await (await get("A", path)).json()).sheet.form, form);
  const revised = { ...form, "hd11-distillation": "athanor-corporis" };
  assert.equal((await writeSheet("A", path, "PUT", { form: revised, revision: 1 })).status, 200);
  await initializeSchema(pool);
  assert.deepEqual((await (await get("A", path)).json()).sheet.form, revised);
  assert.deepEqual((await pool.query("SELECT form FROM sheets WHERE id = $1", [sheet.id])).rows[0].form, revised);
  assert.equal((await get("B", path)).status, 404);
});

test("landing is public for every visitor and does not serve the authenticated frontend", async () => {
  for (const path of ["/", "/index.html", "/?compartilhar=1"]) {
    for (const headers of [{}, { Cookie: "session=A" }, { Cookie: "session=invalid" },
      { "User-Agent": "WhatsApp/2.24" }, { "User-Agent": "facebookexternalhit/1.1" },
      { "User-Agent": "UnknownPreviewBot" }, { Cookie: "session=broken" }]) {
      const response = await page(path, headers);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Accel-Redirect"), "/_landing.html");
      assert.equal(response.headers.get("Location"), null);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
  }
});

test("link readers cannot bypass authentication for private APIs", async () => {
  for (const agent of ["WhatsApp/2.24", "facebookexternalhit/1.1", "UnknownPreviewBot"]) {
    for (const path of ["/api/session", "/api/sheets", "/api/sheets/00000000-0000-4000-8000-000000000001/drawing/source"]) {
      const response = await page(path, { "User-Agent": agent });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("X-Accel-Redirect"), null);
      assert.deepEqual(await response.json(), { error: "LOGIN_REQUIRED" });
    }
  }
});

test("protected pages redirect before HTML is delivered and preserve the requested destination", async () => {
  for (const path of ["/fichas", "/sistemas/vampiro/nova?tema=claro&next=https://example.org"]) {
    for (const headers of [{}, { Cookie: "session=invalid" }, {
      "X-authentik-uid": uidA, "X-authentik-username": "pyu", "X-authentik-groups": "fichasrpg-users",
      "X-Forwarded-Host": "example.org",
    }]) {
      const response = await page(path, headers);
      assert.equal(response.status, 302);
      const login = new URL(response.headers.get("Location"));
      assert.equal(login.origin, origin);
      assert.equal(login.pathname, "/outpost.goauthentik.io/start");
      assert.equal(login.searchParams.get("rd"), origin + path);
      assert.equal(response.headers.get("X-Accel-Redirect"), null);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
  }
});

test("authenticated pages authorize Nginx to serve its HTML without copying frontend files into the API", async () => {
  for (const path of ["/fichas", "/sistemas/mutantes/nova"]) {
    const response = await page(path, { Cookie: "session=A" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Accel-Redirect"), "/_portal.html");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Vary"), "Cookie");
    assert.equal(await response.text(), "");
  }
});

test("registration HTML stays public while unknown API routes keep their JSON response", async () => {
  for (const path of ["/cadastro", "/cadastro?itoken=old-link", "/cadastro/confirmacao"]) {
    const response = await page(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Accel-Redirect"), "/_portal.html");
  }
  const anonymous = await page("/api/unknown");
  assert.equal(anonymous.status, 401);
  assert.deepEqual(await anonymous.json(), { error: "LOGIN_REQUIRED" });
  const authenticated = await page("/api/unknown", { Cookie: "session=A" });
  assert.equal(authenticated.status, 404);
  assert.deepEqual(await authenticated.json(), { error: "NOT_FOUND" });
  assert.equal(authenticated.headers.get("X-Accel-Redirect"), null);
});

test("page access denied and authentication outages do not serve HTML or create login loops", async () => {
  for (const [cookie, status] of [["session=outsider", 403], ["session=broken", 503]]) {
    const response = await page("/fichas", { Cookie: cookie });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(response.headers.get("X-Accel-Redirect"), null);
  }
});
