import assert from "node:assert/strict";
import { test } from "node:test";
import { advantages, attributes, bloodFields, disciplines, flaws, identityFields, nextTrackValue,
  pointFields, skills, trackFields, trackStates, trackValue } from "./data.js";
import { parseSheetFile, sheetExport } from "../../features/sheets/sheetFiles.js";
import { vampireDotFields, vampireForm, vampireTextFields, vampireTrackFields } from "../../../test/fixtures/vampire.js";

test("every legacy field is represented once, including irregular point ranges", () => {
  const texts = [...identityFields.map(([name]) => name), ...skills.flatMap(group => group.traits.map(([, name]) => name)),
    ...disciplines.flatMap(({ name, powers }) => [name, ...powers]), "ressonancia",
    ...advantages.map(({ name }) => name), ...flaws.map(({ name }) => name),
    ...bloodFields.map(([name]) => name), "et", "eg", "anotacoes"];
  const dots = [...attributes.flatMap(group => group.traits.flatMap(([, start]) => pointFields(start))),
    ...skills.flatMap(group => group.traits.flatMap(([, , start]) => pointFields(start))),
    ...[...disciplines, ...advantages, ...flaws].flatMap(({ points }) => points), ...pointFields(336, 10)];
  const tracks = [...trackFields(1, 10), ...trackFields(11, 10), ...trackFields(21, 5), ...trackFields(26, 10)];
  for (const [actual, expected] of [[texts, vampireTextFields], [dots, vampireDotFields], [tracks, vampireTrackFields]]) {
    assert.equal(new Set(actual).size, actual.length, "Duplicate field would overwrite another value");
    assert.deepEqual(actual.toSorted(), expected.toSorted());
  }
  assert.equal(texts.length + dots.length + tracks.length, 490);
  assert.deepEqual(advantages[0].points, ["rd206", "rd207", "rd208", "rd209", "rd230"]);
  assert.deepEqual(flaws[2].points, ["rd286", "rd287", "rd288", "rd289", "rd300"]);
});

test("each track cycles through its own allowed states and returns to empty", () => {
  for (const [kind, states] of Object.entries(trackStates)) {
    let value;
    for (const expected of [...states.slice(1), states[0]]) {
      value = nextTrackValue(value, kind);
      assert.equal(value, expected);
    }
    assert.equal(trackValue("invalid", kind), "1");
    assert.equal(trackValue(4, kind), "4");
  }
  assert.equal(trackValue("3", "humanity"), "1");
  assert.equal(trackValue("2", "hunger"), "1");
});

test("export and import preserve all vampire fields and their types", () => {
  const form = vampireForm();
  const data = sheetExport({ system: "vampiro", name: "Ficha" }, form);
  assert.deepEqual(parseSheetFile(JSON.stringify(data), "vampiro").form, form);
  const legacy = [{ tema: "dark" }, ...Object.entries(form).filter(([id]) => id !== "vampire-theme").map(([id, value]) =>
    typeof value === "boolean" ? { id, checked: value } : id.startsWith("es") ? { id, alt: value } : { id, value })];
  assert.deepEqual(parseSheetFile(JSON.stringify(legacy), "vampiro").form, form);
});
