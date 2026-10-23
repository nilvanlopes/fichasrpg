import { trackStates } from "./data.js";

function legacyTrackState(entry, index) {
  const states = index <= 20 ? trackStates.damage : index <= 25 ? trackStates.hunger : trackStates.humanity;
  // V1 stored the displayed image and a cycle index in alt. Hunger's index 2
  // and Humanity's index 3 both meant image 4 (filled), not states 2 and 3.
  const image = typeof entry.src === "string" && entry.src.match(/(?:^|\/)trilhascheckbox\/([1-4])\.png(?:[?#].*)?$/i);
  if (image && states.includes(image[1])) return image[1];
  const alt = String(entry.alt ?? "");
  const cycleIndex = Number(alt) - 1;
  if (Number.isInteger(cycleIndex) && cycleIndex >= 0 && cycleIndex < states.length) return states[cycleIndex];
  if (states.includes(alt)) return alt;
  throw new Error("O arquivo contém um estado de trilha inválido.");
}

export function legacyVampireForm(entries) {
  const form = {};
  const latest = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.tema) form["vampire-theme"] = entry.tema === "dark" ? "dark" : "light";
    if (!/^[a-z][a-z0-9-]{0,119}$/.test(entry.id || "")) continue;
    latest.set(entry.id, entry);
  }
  for (const entry of latest.values()) {
    const track = /^es([1-9]|[12]\d|3[0-5])$/.exec(entry.id);
    // Each save appended another snapshot. Last occurrence wins, including
    // unchecked dots and fields deliberately cleared in the final snapshot.
    if (Object.hasOwn(entry, "checked")) form[entry.id] = Boolean(entry.checked);
    else if (track && (Object.hasOwn(entry, "alt") || Object.hasOwn(entry, "src"))) {
      form[entry.id] = legacyTrackState(entry, Number(track[1]));
    } else if (Object.hasOwn(entry, "alt")) form[entry.id] = String(entry.alt);
    else if (Object.hasOwn(entry, "value")) form[entry.id] = String(entry.value ?? "");
  }
  return form;
}
