import { getSystem } from "../../systems/registry.js";

export function characterName(form, system) {
  const name = form[getSystem(system)?.nameField];
  return typeof name === "string" ? name.trim().slice(0, 120) : "";
}

export function sheetExport(sheet, form) {
  return { version: 1, system: sheet.system, name: characterName(form, sheet.system) || sheet.name, form };
}

export function downloadSheet(sheet, form) {
  const data = sheetExport(sheet, form);
  const filename = data.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename || `ficha-${sheet.system}`}.json`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

export function parseSheetFile(text, system) {
  const definition = getSystem(system);
  if (!definition) throw new Error("Sistema de RPG não encontrado.");
  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Não foi possível ler esse JSON. Selecione um arquivo de ficha válido.");
  }
  if (data?.system && data.system !== system) throw new Error("Este arquivo pertence a outro sistema de RPG.");
  if (data?.version !== undefined && data.version !== 1) throw new Error("Esta versão do arquivo não é compatível.");
  let form = data?.form;
  const legacy = Array.isArray(data) ? data : form;
  if (definition.importLegacyForm && Array.isArray(legacy)) form = definition.importLegacyForm(legacy);
  if (!form || typeof form !== "object" || Array.isArray(form)) throw new Error("O arquivo não contém os dados de uma ficha.");
  const entries = Object.entries(form);
  if (entries.length > 2000 || !entries.every(([key, value]) =>
    /^[a-z][a-z0-9-]{0,119}$/.test(key) && !["constructor", "prototype"].includes(key) &&
    ((typeof value === "string" && value.length <= 16000) || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))))) {
    throw new Error("O arquivo contém campos inválidos ou excede os limites da ficha.");
  }
  const name = typeof data?.name === "string" ? data.name.trim().slice(0, 120) : "";
  return { system, name: characterName(form, system) || name || `Ficha de ${definition.label}`, form };
}
