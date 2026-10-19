import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadSheet, parseSheetFile, sheetExport } from "./sheetFiles.js";

for (const system of ["mutantes", "vampiro"]) {
  test(`${system}: exportação e importação preservam todos os campos`, () => {
    const form = { [system === "mutantes" ? "nome-personagem" : "nome"]: "Herói da Noite", marcado: true, pontos: 4, notas: "a\nb", vazio: "" };
    const exported = sheetExport({ system, name: "Nome anterior", id: "original", owner_uid: "privado" }, form);
    assert.deepEqual(parseSheetFile(JSON.stringify(exported), system), { system, name: "Herói da Noite", form });
    assert.equal(exported.owner_uid, undefined);
    assert.equal(exported.id, undefined);
  });
}

test("recusa JSON de outro sistema sem converter os campos", () => {
  assert.throws(() => parseSheetFile(JSON.stringify({ system: "vampiro", form: { nome: "A" } }), "mutantes"), /outro sistema/);
});

test("recusa arquivos inválidos, versões incompatíveis e dados que a API não aceita", () => {
  for (const text of ["{", "null", "[]", '{"form":null}', '{"form":[]}', '{"form":{"campo":{}}}',
    '{"form":{"constructor":"x"}}', '{"version":2,"form":{}}', JSON.stringify({ form: { notas: "x".repeat(16001) } })]) {
    assert.throws(() => parseSheetFile(text, "mutantes"));
  }
});

test("preserva tema, trilhas, campos e marcações de arquivos antigos de Vampiro", () => {
  const legacy = [{ tema: "dark" }, { id: "nome", value: "Lia" }, { id: "es1", alt: "4" }, { id: "forca1", checked: true }];
  const expected = { system: "vampiro", name: "Lia", form: { "vampire-theme": "dark", nome: "Lia", es1: "4", forca1: true } };
  assert.deepEqual(parseSheetFile(JSON.stringify(legacy), "vampiro"), expected);
  assert.deepEqual(parseSheetFile(JSON.stringify({ form: legacy }), "vampiro"), expected);
});

test("o download contém o formulário atual e libera os recursos após baixar", async t => {
  const previousDocument = globalThis.document;
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  let blob, clicked = false, removed = false, appended = false, revoked;
  const link = { click() { clicked = true; }, remove() { removed = true; } };
  globalThis.document = { createElement: () => link, body: { append: element => { assert.equal(element, link); appended = true; } } };
  t.mock.method(URL, "createObjectURL", data => { blob = data; return "blob:teste"; });
  t.mock.method(URL, "revokeObjectURL", url => { revoked = url; });
  const form = { "nome-personagem": "Cavaleiro Prateado", notas: "Ainda não salvo" };
  downloadSheet({ system: "mutantes", name: "Ficha anterior" }, form);
  assert.equal(blob.type, "application/json");
  assert.deepEqual(JSON.parse(await blob.text()).form, form);
  assert.equal(link.download, "cavaleiro-prateado.json");
  assert.ok(appended && clicked && removed);
  assert.equal(revoked, "blob:teste");
});
