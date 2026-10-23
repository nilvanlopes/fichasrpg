import { readFile } from "node:fs/promises";

function validText(value, max = 200) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export function validateVampireCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.disciplines) || typeof catalog.sourceUrl !== "string") {
    throw new Error("Catálogo de disciplinas inválido");
  }
  const ids = new Set();
  const names = new Set();
  const powerIds = new Set();
  for (const discipline of catalog.disciplines) {
    if (!validText(discipline.id) || !validText(discipline.name) || !Array.isArray(discipline.powers)
      || ids.has(discipline.id) || names.has(discipline.name)) throw new Error("Disciplina inválida ou duplicada");
    ids.add(discipline.id);
    names.add(discipline.name);
    const powerNames = new Set();
    for (const power of discipline.powers) {
      if (!validText(power.id) || !validText(power.name) || !Number.isInteger(power.level)
        || power.level < 1 || power.level > 5 || powerIds.has(power.id) || powerNames.has(power.name)
        || (power.description !== undefined && typeof power.description !== "string")
        || (power.details !== undefined && (!power.details || typeof power.details !== "object" || Array.isArray(power.details)))) {
        throw new Error("Poder de disciplina inválido ou duplicado");
      }
      powerIds.add(power.id);
      powerNames.add(power.name);
    }
  }
  return catalog;
}

// Run inside the schema transaction, so a partial catalog is never published.
export async function seedVampireCatalog(client, catalog) {
  validateVampireCatalog(catalog);
  if (!catalog.disciplines.length) return;
  await client.query(`INSERT INTO vampire_disciplines (id, name, source_url)
    SELECT id, name, $2 FROM jsonb_to_recordset($1::jsonb) AS d(id text, name text)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, source_url = EXCLUDED.source_url`,
  [JSON.stringify(catalog.disciplines), catalog.sourceUrl]);
  const powers = catalog.disciplines.flatMap(discipline => discipline.powers.map(power => ({
    ...power, discipline_id: discipline.id, description: power.description || "", details: power.details || {},
  })));
  await client.query(`INSERT INTO vampire_discipline_powers (id, discipline_id, name, level, description, details)
    SELECT id, discipline_id, name, level, description, details
    FROM jsonb_to_recordset($1::jsonb) AS p(id text, discipline_id text, name text, level integer, description text, details jsonb)
    ON CONFLICT (id) DO UPDATE SET discipline_id = EXCLUDED.discipline_id, name = EXCLUDED.name,
      level = EXCLUDED.level, description = EXCLUDED.description, details = EXCLUDED.details`, [JSON.stringify(powers)]);
}

export async function loadVampireCatalog() {
  return validateVampireCatalog(JSON.parse(await readFile(new URL("./data/vampire-disciplines.json", import.meta.url), "utf8")));
}
