import assert from "node:assert/strict";
import { test } from "node:test";
import { loadVampireCatalog, seedVampireCatalog, validateVampireCatalog } from "./vampireCatalog.js";

const fixture = () => ({ sourceUrl: "https://example.org/catalogo", disciplines: [
  { id: "disciplina-teste", name: "Disciplina de teste", powers: [
    { id: "poder-teste", name: "Poder de teste", level: 1, details: { Custo: "Um ponto" } },
  ] },
] });

test("o catálogo versionado pode ser importado no PostgreSQL", async () => {
  const catalog = validateVampireCatalog(await loadVampireCatalog());
  assert.equal(catalog.disciplines.length, 11);
  assert.equal(catalog.disciplines.flatMap(item => item.powers).length, 95);
  assert.ok(catalog.disciplines.find(item => item.name === "Animalism").powers.some(item => item.name === "Bond Famulus" && item.level === 1));
  assert.ok(catalog.disciplines.find(item => item.name === "Thin-Blood Alchemy").powers.some(item => item.name === "Awaken the Sleeper" && item.level === 5));
});

test("os 95 poderes contêm descrição e sistema; requisitos e regras adicionais permanecem separados", async () => {
  const powers = (await loadVampireCatalog()).disciplines.flatMap(item => item.powers);
  assert.ok(powers.every(power => power.description.trim() && power.details.system.trim()));
  assert.equal(powers.filter(power => power.details.dicePool).length, 44);
  assert.equal(powers.filter(power => power.details.ingredients).length, 7);
  assert.equal(powers.find(power => power.name === "Unliving Hive").details.amalgam, "Obfuscate 2");
  assert.equal(powers.find(power => power.name === "Vanish").details.prerequisite, "Cloak of Shadows");
  assert.equal(powers.find(power => power.name === "Metamorphosis").details.prerequisite, "Shapechange");
  assert.ok(powers.find(power => power.name === "Defractionate").details.calcinatio);
});

test("catálogo rejeita poderes sem nível, níveis fora do intervalo e duplicatas antes de gravar", async () => {
  for (const level of [undefined, "1", 0, 6]) {
    const catalog = fixture();
    catalog.disciplines[0].powers[0].level = level;
    await assert.rejects(seedVampireCatalog({ query: () => assert.fail("Não deve gravar catálogo inválido") }, catalog));
  }
  const duplicate = fixture();
  duplicate.disciplines[0].powers.push({ ...duplicate.disciplines[0].powers[0], id: "outro-id" });
  assert.throws(() => validateVampireCatalog(duplicate), /duplicado/);
  const duplicateDiscipline = fixture();
  duplicateDiscipline.disciplines.push({ ...duplicateDiscipline.disciplines[0], id: "outra-disciplina" });
  assert.throws(() => validateVampireCatalog(duplicateDiscipline), /duplicada/);
});

test("importação preserva nível, fonte e detalhes usando parâmetros SQL", async () => {
  const queries = [];
  await seedVampireCatalog({ query: async (sql, values) => queries.push({ sql, values }) }, fixture());
  assert.equal(queries.length, 2);
  assert.equal(queries[0].values[1], "https://example.org/catalogo");
  assert.deepEqual(JSON.parse(queries[1].values[0]), [{
    id: "poder-teste", name: "Poder de teste", level: 1, description: "", discipline_id: "disciplina-teste",
    details: { Custo: "Um ponto" },
  }]);
});
