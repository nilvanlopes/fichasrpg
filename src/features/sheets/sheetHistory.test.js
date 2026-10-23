import assert from "node:assert/strict";
import { test } from "node:test";
import { SheetHistory, sameForm } from "./sheetHistory.js";

test("histórico começa vazio, ignora alterações idênticas e mantém os tipos dos campos", () => {
  const history = new SheetHistory({ nome: "Original", rd1: false, es1: "1" });
  assert.deepEqual(history.flags, { canUndo: false, canRedo: false });
  assert.equal(history.undo(), false);
  assert.equal(history.redo(), false);
  assert.equal(history.record({ es1: "1", rd1: false, nome: "Original" }), false);
  assert.equal(history.dirty, false);
  assert.equal(sameForm({ valor: false }, { valor: "false" }), false);
});

test("desfazer e refazer restauram o formulário completo; nova edição descarta a sequência de refazer", () => {
  const history = new SheetHistory({ nome: "Original", anotacoes: "Preservar" });
  history.record({ nome: "Primeiro", anotacoes: "Preservar" });
  history.record({ nome: "Segundo", anotacoes: "Preservar" });
  assert.equal(history.undo(), true);
  assert.equal(history.form.nome, "Primeiro");
  assert.deepEqual(history.flags, { canUndo: true, canRedo: true });
  history.undo();
  assert.deepEqual(history.form, { nome: "Original", anotacoes: "Preservar" });
  assert.equal(history.dirty, false);
  history.redo();
  assert.equal(history.form.nome, "Primeiro");
  history.record({ ...history.form, anotacoes: "Nova edição" });
  assert.equal(history.redo(), false);
  assert.equal(history.form.nome, "Primeiro");
});

test("uma ação com vários campos desfaz e refaz os pontos e metadados juntos", () => {
  const history = new SheetHistory({ nd1: "Thin-Blood Alchemy" });
  const batch = {};
  const changes = { hd11: "Sense the Unseen", "hd11-distillation": "fixatio",
    "hd11-mimic-discipline": "auspex", "hd11-mimic-power": "auspex--sense-the-unseen", rd176: true, rd177: true };
  for (const [key, value] of Object.entries(changes)) history.record({ ...history.form, [key]: value }, { batch });
  history.endBatch(batch);
  history.undo();
  assert.deepEqual(history.form, { nd1: "Thin-Blood Alchemy" });
  assert.equal(history.flags.canUndo, false);
  history.redo();
  assert.deepEqual(history.form, { nd1: "Thin-Blood Alchemy", ...changes });
});

test("digitação contínua agrupa letras e separa pausas e mudanças de foco", () => {
  const history = new SheetHistory({});
  for (const [index, name] of ["R", "Ro", "Ron"].entries()) {
    const batch = {};
    history.record({ nome: name }, { batch, groupKey: "nome:insertText", now: index * 100 });
    history.endBatch(batch);
  }
  history.undo();
  assert.deepEqual(history.form, {});
  history.redo();
  history.record({ nome: "Ronn" }, { groupKey: "nome:insertText", now: 2000 });
  history.record({ nome: "Ronny" }, { groupKey: "nome:insertText", now: 2100 });
  history.breakGroup();
  history.record({ nome: "Ronny!" }, { groupKey: "nome:insertText", now: 2200 });
  history.undo();
  assert.equal(history.form.nome, "Ronny");
  history.undo();
  assert.equal(history.form.nome, "Ron");
});

test("salvar preserva o histórico e desfazer durante um salvamento mantém a alteração pendente correta", () => {
  const original = { nome: "Original" };
  const changed = { nome: "Alterado" };
  const history = new SheetHistory(original);
  history.record(changed);
  history.markSaved(changed);
  assert.equal(history.dirty, false);
  assert.equal(history.flags.canUndo, true);
  history.undo();
  assert.equal(history.dirty, true);
  // A response for the previous snapshot must not mark the undone form saved.
  history.markSaved(changed);
  assert.equal(history.dirty, true);
  history.markSaved(original);
  assert.equal(history.dirty, false);
  assert.equal(history.flags.canRedo, true);
  history.redo();
  assert.equal(history.dirty, true);
});

test("limpar é reversível; recarregar outra ficha ou conta reinicia o histórico e limita a memória", () => {
  const history = new SheetHistory({ nome: "Original" }, 3);
  history.record({});
  history.undo();
  assert.equal(history.form.nome, "Original");
  history.reset({ nome: "Outra ficha" });
  assert.deepEqual(history.flags, { canUndo: false, canRedo: false });
  for (let value = 1; value <= 5; value++) history.record({ valor: value });
  for (let step = 0; step < 3; step++) assert.equal(history.undo(), true);
  assert.equal(history.form.valor, 2);
  assert.equal(history.undo(), false);
});
