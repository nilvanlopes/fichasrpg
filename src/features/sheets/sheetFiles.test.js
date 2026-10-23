import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadSheet, parseSheetFile, sheetExport } from "./sheetFiles.js";
import { vampireForm } from "../../../test/fixtures/vampire.js";

for (const system of ["mutantes", "vampiro"]) {
  test(`${system}: exportação e importação preservam todos os campos`, () => {
    const form = { [system === "mutantes" ? "nome-personagem" : "nome"]: "Herói da Noite", marcado: true, pontos: 4, notas: "a\nb", vazio: "" };
    const exported = sheetExport({ system, name: "Nome anterior", id: "original", owner_uid: "privado" }, form);
    assert.deepEqual(parseSheetFile(JSON.stringify(exported), system), { system, name: "Herói da Noite", form });
    assert.equal(exported.owner_uid, undefined);
    assert.equal(exported.id, undefined);
  });

  test(`${system}: importar prioriza o campo Nome sobre um título antigo`, () => {
    const form = { [system === "mutantes" ? "nome-personagem" : "nome"]: "  Nome atualizado  " };
    assert.deepEqual(parseSheetFile(JSON.stringify({ system, name: "Título antigo", form }), system), {
      system, name: "Nome atualizado", form,
    });
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

test("Vampiro v1: usa a imagem exibida quando o alt contém o índice do ciclo", () => {
  const legacy = [
    { id: "es6", alt: "3", src: "https://fichavampiro.netlify.app/img/trilhascheckbox/3.png" },
    { id: "es21", alt: "2", src: "https://fichavampiro.netlify.app/img/trilhascheckbox/4.png" },
    { id: "es25", alt: "1", src: "/img/trilhascheckbox/1.png" },
    { id: "es26", alt: "3", src: "/img/trilhascheckbox/4.png" },
    { id: "es27", alt: "2", src: "/img/trilhascheckbox/2.png" },
    { id: "es28", alt: "1", src: "/img/trilhascheckbox/1.png" },
    { id: "es29", src: "/img/trilhascheckbox/4.png?cache=1" },
  ];
  assert.deepEqual(parseSheetFile(JSON.stringify(legacy), "vampiro").form,
    { es6: "3", es21: "4", es25: "1", es26: "4", es27: "2", es28: "1", es29: "4" });
});

test("Vampiro v1: converte índices de Fome e Humanidade quando a imagem está ausente", () => {
  const legacy = [{ id: "es1", alt: "3" }, { id: "es21", alt: "2" }, { id: "es22", alt: "4" },
    { id: "es26", alt: "3" }, { id: "es27", alt: "2" }, { id: "es28", alt: "4" }];
  assert.deepEqual(parseSheetFile(JSON.stringify({ form: legacy }), "vampiro").form,
    { es1: "3", es21: "4", es22: "4", es26: "4", es27: "2", es28: "4" });
  assert.throws(() => parseSheetFile(JSON.stringify([{ id: "es21", alt: "invalid" }]), "vampiro"), /trilha inválido/);
  assert.equal(parseSheetFile(JSON.stringify([{ id: "es21", alt: "invalid" }, { id: "es21", alt: "2" }]), "vampiro").form.es21, "4");
});

test("Vampiro v1: consolida o histórico antes de validar e preserva o último salvamento", () => {
  const form = vampireForm();
  const snapshot = Object.entries(form).filter(([id]) => id !== "vampire-theme").map(([id, value]) =>
    typeof value === "boolean" ? { id, checked: value, value: value ? "1" : "0" }
      : /^es\d+$/.test(id) ? { id, alt: value, src: `/img/trilhascheckbox/${value}.png` } : { id, value });
  const history = [{ tema: "dark" }, ...Array.from({ length: 33 }, () => snapshot).flat(),
    { id: "nome", value: "Último personagem" }, { id: "rd1", checked: false, value: "1" }, { id: "anotacoes", value: "" }];
  const text = JSON.stringify(history);
  assert.ok(Buffer.byteLength(text) > 512 * 1024);
  assert.ok(Buffer.byteLength(text) < 1024 * 1024);
  assert.deepEqual(parseSheetFile(text, "vampiro"), {
    system: "vampiro", name: "Último personagem",
    form: { ...form, nome: "Último personagem", rd1: false, anotacoes: "" },
  });
});

test("aceita arquivos UTF-8 com BOM e mantém estados do formato atual sem conversão", () => {
  const data = { system: "vampiro", name: "Atual", form: { es21: "4", es26: "2", anotacoes: "Notas" } };
  assert.deepEqual(parseSheetFile("\uFEFF" + JSON.stringify(data), "vampiro"), data);
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
