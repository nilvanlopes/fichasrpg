import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { canMimicPower, clearFormula, distillationMethods, formulaAlreadyKnown, formulaFields,
  isThinBloodAlchemy, readFormula, writeFormula } from "./thinBloodAlchemy.js";
import { disciplines } from "./data.js";
import { parseSheetFile, sheetExport } from "../../features/sheets/sheetFiles.js";

test("imitação exclui Blood Sorcery, a própria Alquimia e poderes fora dos níveis 1–4", async () => {
  const catalog = JSON.parse(await readFile(new URL("../../../server/data/vampire-disciplines.json", import.meta.url), "utf8"));
  const eligible = catalog.disciplines.filter(discipline => discipline.powers.some(power => canMimicPower(discipline, power)));
  assert.equal(eligible.length, 9);
  assert.ok(!eligible.some(discipline => ["blood-sorcery", "thin-blood-alchemy"].includes(discipline.id)));
  for (const discipline of catalog.disciplines) {
    assert.ok(!canMimicPower(discipline, { level: 5 }));
    assert.ok(!canMimicPower(discipline, { level: 0 }));
    assert.ok(!canMimicPower(discipline, { level: "1" }));
  }
  assert.ok(canMimicPower({ id: "auspex" }, { level: 4 }));
  assert.ok(isThinBloodAlchemy("Thin-Blood Alchemy"));
  assert.ok(isThinBloodAlchemy("Alquimia de Sangue Ralo"));
});

test("cada fórmula exige método e preserva origem, poder e método na exportação e importação", () => {
  const form = { nd1: "Thin-Blood Alchemy", hd21: "Preservar outro bloco" };
  const onChange = (key, value) => { form[key] = value; };
  const formula = { name: "Sense the Unseen", discipline: "auspex", power: "auspex--sense-the-unseen", method: "fixatio" };
  assert.equal(writeFormula("hd11", { ...formula, method: "" }, onChange), false);
  assert.equal(form.hd11, undefined);
  assert.equal(writeFormula("hd11", formula, onChange), true);
  assert.deepEqual(readFormula(form, "hd11"), { method: "fixatio", discipline: "auspex", power: "auspex--sense-the-unseen" });
  assert.equal(form.hd21, "Preservar outro bloco");
  assert.deepEqual(parseSheetFile(JSON.stringify(sheetExport({ system: "vampiro", name: "Teste" }, form)), "vampiro").form, form);
  for (const key of Object.values(formulaFields("hd11"))) assert.match(key, /^[a-z][a-z0-9-]{0,119}$/);
});

test("a mesma fórmula pode ser aprendida em métodos diferentes e só duplica quando método e origem coincidem", () => {
  const form = { nd1: "Thin-Blood Alchemy" };
  const onChange = (key, value) => { form[key] = value; };
  const formula = { name: "Haze", method: "fixatio" };
  writeFormula("hd11", formula, onChange);
  assert.ok(formulaAlreadyKnown(form, disciplines[0], formula));
  assert.ok(!formulaAlreadyKnown(form, disciplines[0], { ...formula, method: "calcinatio" }));
  assert.ok(!formulaAlreadyKnown(form, disciplines[0], formula, "hd11"));
  assert.ok(!formulaAlreadyKnown(form, disciplines[0], { ...formula, discipline: "obfuscate", power: "outro" }));
  writeFormula("hd12", { ...formula, method: "calcinatio" }, onChange);
  assert.deepEqual(distillationMethods.map(method => method.id), ["athanor-corporis", "fixatio", "calcinatio"]);
});

test("remover a fórmula elimina metadados; trocar uma cópia por fórmula nativa remove a origem anterior", () => {
  const form = {};
  const onChange = (key, value) => { form[key] = value; };
  writeFormula("hd11", { name: "Awe", method: "athanor-corporis", discipline: "presence", power: "presence--awe" }, onChange);
  writeFormula("hd11", { name: "Haze", method: "fixatio" }, onChange);
  assert.deepEqual(readFormula(form, "hd11"), { method: "fixatio", discipline: "", power: "" });
  clearFormula("hd11", onChange);
  assert.deepEqual(readFormula(form, "hd11"), { method: "", discipline: "", power: "" });
});
