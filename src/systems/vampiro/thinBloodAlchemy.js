export const distillationMethods = [
  { id: "athanor-corporis", name: "Athanor Corporis" },
  { id: "fixatio", name: "Fixatio" },
  { id: "calcinatio", name: "Calcinatio" },
];

export const normalizeName = value => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function isThinBloodAlchemy(value) {
  const name = normalizeName(typeof value === "object" && value ? value.id || value.name : value).replace(/[^a-z0-9]/g, "");
  return name === "thinbloodalchemy" || name === "alquimiadesangueralo";
}

export function canMimicPower(discipline, power) {
  if (!discipline || !power || isThinBloodAlchemy(discipline)) return false;
  const name = normalizeName(discipline.id || discipline.name).replace(/[^a-z0-9]/g, "");
  return !["bloodsorcery", "feiticariadesangue"].includes(name)
    && Number.isInteger(power.level) && power.level >= 1 && power.level <= 4;
}

export function formulaFields(key) {
  return { method: `${key}-distillation`, discipline: `${key}-mimic-discipline`, power: `${key}-mimic-power` };
}

export function readFormula(form, key) {
  const fields = formulaFields(key);
  return { method: form[fields.method] || "", discipline: form[fields.discipline] || "", power: form[fields.power] || "" };
}

export function clearFormula(key, onChange) {
  Object.values(formulaFields(key)).forEach(field => onChange(field, ""));
}

export function formulaAlreadyKnown(form, fields, candidate, ignoredKey) {
  return fields.powers.some(key => {
    if (key === ignoredKey || normalizeName(form[key]) !== normalizeName(candidate.name)) return false;
    const formula = readFormula(form, key);
    return formula.method === candidate.method && formula.discipline === (candidate.discipline || "")
      && formula.power === (candidate.power || "");
  });
}

export function writeFormula(key, candidate, onChange) {
  if (!distillationMethods.some(method => method.id === candidate.method)) return false;
  const fields = formulaFields(key);
  onChange(key, candidate.name);
  onChange(fields.method, candidate.method);
  onChange(fields.discipline, candidate.discipline || "");
  onChange(fields.power, candidate.power || "");
  return true;
}
