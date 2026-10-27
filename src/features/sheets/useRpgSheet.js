import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, writeHeaders } from "../../shared/api/client";
import { characterName, downloadSheet, parseSheetFile } from "./sheetFiles.js";
import { getSystem } from "../../systems/registry.js";
import { SheetHistory } from "./sheetHistory.js";

export function useRpgSheet(sheetId, system) {
  const [state, setState] = useState({
    sheet: null, user: null, form: {}, revision: 0, ready: false, loading: true,
    dirty: false, saving: false, deleting: false, importing: false, failure: "", status: "Carregando ficha…", legacy: null,
    canUndo: false, canRedo: false,
  });
  const current = useRef(state);
  const persistedId = useRef(sheetId === "nova" ? null : sheetId);
  const generation = useRef(0);
  const mounted = useRef(false);
  const history = useRef(null);
  if (!history.current) history.current = new SheetHistory();
  const editBatch = useRef(null);
  const patch = useCallback(values => {
    const next = { ...current.current, ...values };
    // The character's name is also the sheet's title, including edits made
    // while an earlier save is still in flight.
    if (next.sheet) next.sheet = { ...next.sheet, name: characterName(next.form, next.sheet.system) || "Ficha sem nome" };
    current.current = next;
    if (mounted.current) setState(current.current);
  }, []);

  const load = useCallback(async () => {
    const version = ++generation.current;
    history.current.reset({});
    editBatch.current = null;
    patch({ sheet: null, user: null, form: {}, ready: false, loading: true, dirty: false,
      saving: false, deleting: false, importing: false, failure: "", legacy: null, canUndo: false, canRedo: false, status: "Carregando ficha…" });
    try {
      let user, sheet;
      if (persistedId.current) {
        ({ user, sheet } = await apiRequest(`/api/sheets/${encodeURIComponent(persistedId.current)}`));
      } else {
        ({ user } = await apiRequest("/api/session"));
        sheet = { id: null, system, form: {}, revision: 0 };
      }
      if (sheet.system !== system) {
        throw Object.assign(new Error("Esta ficha pertence a outro sistema de RPG."), { code: "SYSTEM_MISMATCH" });
      }
      if (!mounted.current || version !== generation.current) return;
      history.current.reset(sheet.form);
      patch({ sheet, user, form: sheet.form, revision: sheet.revision, ready: true, loading: false,
        status: "",
        legacy: getSystem(sheet.system)?.readLegacyForm?.(user, sheet.form) ?? null });
    } catch (error) {
      if (mounted.current && version === generation.current) {
        patch({ loading: false, failure: error.code, status: error.message });
      }
    }
  }, [patch, system]);

  const save = useCallback(async () => {
    const snapshot = current.current;
    if (!snapshot.ready || snapshot.saving || snapshot.deleting || snapshot.importing || snapshot.failure === "SHEET_CONFLICT") return;
    const version = generation.current;
    patch({ saving: true, failure: "", status: "" });
    try {
      const isNew = !snapshot.sheet.id;
      const name = snapshot.sheet.name;
      const { sheet } = await apiRequest(isNew ? "/api/sheets" : `/api/sheets/${encodeURIComponent(snapshot.sheet.id)}`, {
        method: isNew ? "POST" : "PUT",
        headers: writeHeaders(snapshot.user.uid),
        body: JSON.stringify(isNew
          ? { system: snapshot.sheet.system, form: snapshot.form, name }
          : { form: snapshot.form, revision: snapshot.revision, name }),
      });
      if (!mounted.current || version !== generation.current) return;
      persistedId.current = sheet.id;
      if (isNew) window.history.replaceState(null, "", `/sistemas/${snapshot.sheet.system}/${sheet.id}`);
      history.current.markSaved(snapshot.form);
      const dirty = history.current.dirty;
      patch({ sheet: { ...snapshot.sheet, ...sheet }, revision: sheet.revision, saving: false,
        dirty, legacy: null, status: "" });
      return sheet;
    } catch (error) {
      if (!mounted.current || version !== generation.current) return;
      if (["LOGIN_REQUIRED", "ACCESS_DENIED"].includes(error.code)) {
        history.current.reset({});
        patch({ ready: false, user: null, form: {}, dirty: false, legacy: null, canUndo: false, canRedo: false });
      }
      patch({ saving: false, failure: error.code, status: error.message });
      return null;
    }
  }, [patch]);

  useEffect(() => {
    mounted.current = true;
    persistedId.current = sheetId === "nova" ? null : sheetId;
    load();
    return () => { mounted.current = false; generation.current += 1; };
  }, [load, sheetId]);

  useEffect(() => {
    if (!state.ready || !state.sheet?.id || !state.dirty || state.saving || state.deleting || state.importing || state.failure) return undefined;
    const timer = setTimeout(save, 800);
    return () => clearTimeout(timer);
  }, [state.form, state.sheet?.id, state.ready, state.dirty, state.saving, state.deleting, state.importing, state.failure, save]);

  useEffect(() => {
    let checking = false;
    const verifyAccount = async () => {
      if (checking || !current.current.ready || document.visibilityState === "hidden") return;
      checking = true;
      const version = generation.current;
      try {
        const { user } = await apiRequest("/api/session");
        if (mounted.current && version === generation.current && user.uid !== current.current.user?.uid) await load();
      } catch (error) {
        if (mounted.current && version === generation.current && ["LOGIN_REQUIRED", "ACCESS_DENIED"].includes(error.code)) {
          generation.current += 1;
          history.current.reset({});
          patch({ ready: false, user: null, form: {}, dirty: false, saving: false,
            legacy: null, failure: error.code, status: error.message, canUndo: false, canRedo: false });
        }
      } finally { checking = false; }
    };
    const timer = setInterval(verifyAccount, 60000);
    window.addEventListener("focus", verifyAccount);
    document.addEventListener("visibilitychange", verifyAccount);
    const beforeUnload = event => {
      if (!current.current.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", verifyAccount);
      document.removeEventListener("visibilitychange", verifyAccount);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [load, patch]);

  const onChange = useCallback((name, value, options = {}) => {
    const snapshot = current.current;
    if (!snapshot.ready || snapshot.importing || snapshot.deleting || snapshot.failure === "SHEET_CONFLICT") return;
    if (Object.is(snapshot.form[name], value)) return;
    if (!editBatch.current) {
      const batch = {};
      editBatch.current = batch;
      queueMicrotask(() => {
        if (editBatch.current === batch) editBatch.current = null;
        history.current.endBatch(batch);
      });
    }
    const singleCharacter = typeof value === "string" && Math.abs(value.length - String(snapshot.form[name] ?? "").length) === 1;
    const continuousInput = !options.inputType || ["insertText", "deleteContentBackward", "deleteContentForward", "insertCompositionText"].includes(options.inputType);
    history.current.record({ ...snapshot.form, [name]: value }, { batch: editBatch.current,
      groupKey: options.typing && singleCharacter && continuousInput ? `${name}:${options.inputType || "text"}` : null });
    patch({ form: history.current.form, dirty: history.current.dirty, ...history.current.flags, legacy: null,
      failure: "", status: "" });
  }, [patch]);

  const replaceForm = useCallback(form => {
    if (!current.current.ready || current.current.importing || current.current.deleting || current.current.failure === "SHEET_CONFLICT") return;
    history.current.record(form);
    patch({ form: history.current.form, dirty: history.current.dirty, ...history.current.flags,
      legacy: null, failure: "", status: "" });
  }, [patch]);

  const moveHistory = useCallback(direction => {
    const snapshot = current.current;
    if (!snapshot.ready || snapshot.importing || snapshot.deleting || snapshot.legacy || snapshot.failure === "SHEET_CONFLICT") return;
    if (!history.current[direction]()) return;
    document.querySelectorAll("[popover]:popover-open").forEach(popover => popover.hidePopover());
    patch({ form: history.current.form, dirty: history.current.dirty, ...history.current.flags,
      legacy: null, failure: "", status: "" });
  }, [patch]);
  const undo = useCallback(() => moveHistory("undo"), [moveHistory]);
  const redo = useCallback(() => moveHistory("redo"), [moveHistory]);

  useEffect(() => {
    const keydown = event => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (!["z", "y"].includes(key)) return;
      const editable = event.target.closest?.("input, textarea, select, [contenteditable='true']");
      // Searches and selection dialogs keep their own editing behavior.
      if (editable && !editable.hasAttribute("data-field")) return;
      const modal = document.querySelector("dialog[open]");
      if (modal && !modal.querySelector("input[data-field], textarea[data-field], select[data-field]")) return;
      const snapshot = current.current;
      if (!snapshot.ready || snapshot.importing || snapshot.deleting || snapshot.legacy || snapshot.failure === "SHEET_CONFLICT") return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo(); else undo();
    };
    const focusout = event => {
      if (event.target.matches?.("input[data-field], textarea[data-field]")) history.current.breakGroup();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusout", focusout);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusout", focusout);
    };
  }, [undo, redo]);

  const clear = () => {
    if (window.confirm("Limpar todos os campos desta ficha?")) replaceForm({});
  };
  const newSheet = () => {
    const snapshot = current.current;
    if (!snapshot.ready || snapshot.saving || snapshot.deleting || snapshot.importing) return;
    if (snapshot.dirty && !window.confirm("Abrir uma nova ficha e descartar as alterações ainda não salvas?")) return;
    generation.current += 1;
    // The explicit confirmation above also covers beforeunload, avoiding a
    // second prompt. Opening a draft does not create a database record.
    patch({ ready: false, dirty: false, loading: true, status: "Abrindo nova ficha…" });
    window.location.assign(`/sistemas/${system}/nova`);
  };
  const reload = () => {
    const message = current.current.sheet?.id
      ? "Recarregar a ficha do banco e descartar as alterações ainda não salvas?"
      : "Descartar as alterações desta ficha ainda não salva?";
    if (!current.current.saving && (!current.current.dirty || window.confirm(message))) load();
  };
  const importLegacy = () => {
    const snapshot = current.current;
    if (snapshot.legacy) replaceForm(snapshot.legacy);
  };
  const startEmpty = () => replaceForm({});
  const logout = () => {
    if (!current.current.dirty || window.confirm("Sair com alterações ainda não salvas?")) {
      generation.current += 1;
      history.current.reset({});
      patch({ ready: false, form: {}, user: null, dirty: false, canUndo: false, canRedo: false });
      window.location.assign("/api/logout");
    }
  };

  const remove = async () => {
    const snapshot = current.current;
    if (!snapshot.ready || !snapshot.sheet?.id || !snapshot.user || snapshot.saving || snapshot.deleting || snapshot.importing) return;
    if (!window.confirm(`Deseja excluir a ficha “${snapshot.sheet.name}”? Esta ação não pode ser desfeita.`)) return;
    const version = generation.current;
    patch({ deleting: true });
    try {
      await apiRequest(`/api/sheets/${encodeURIComponent(snapshot.sheet.id)}`, {
        method: "DELETE",
        headers: writeHeaders(snapshot.user.uid),
      });
      if (!mounted.current || version !== generation.current) return;
      generation.current += 1;
      patch({ ready: false, dirty: false, deleting: false });
      window.location.assign("/fichas");
    } catch (error) {
      if (!mounted.current || version !== generation.current) return;
      patch({ deleting: false });
      window.alert(error.message);
    }
  };

  const exportFile = () => {
    const snapshot = current.current;
    if (snapshot.ready && !snapshot.importing) downloadSheet(snapshot.sheet, snapshot.form);
  };

  const importFile = async file => {
    const snapshot = current.current;
    if (!file || !snapshot.ready || !snapshot.user || snapshot.saving || snapshot.deleting || snapshot.importing) return;
    const version = generation.current;
    patch({ importing: true });
    try {
      if (file.size > 1024 * 1024) throw new Error("O arquivo deve ter no máximo 1 MB.");
      const data = parseSheetFile(await file.text(), snapshot.sheet.system);
      if (!mounted.current || version !== generation.current) return;
      if (current.current.dirty && !window.confirm("Abrir a ficha importada e descartar as alterações ainda não salvas da ficha atual?")) {
        patch({ importing: false });
        return;
      }
      const { sheet } = await apiRequest("/api/sheets", {
        method: "POST", headers: writeHeaders(snapshot.user.uid), body: JSON.stringify(data),
      });
      if (!mounted.current || version !== generation.current) return;
      generation.current += 1;
      persistedId.current = sheet.id;
      history.current.reset(sheet.form);
      editBatch.current = null;
      window.history.replaceState(null, "", `/sistemas/${sheet.system}/${sheet.id}`);
      patch({ sheet, form: sheet.form, revision: sheet.revision, dirty: false, importing: false, canUndo: false, canRedo: false,
        failure: "", legacy: null, status: "" });
    } catch (error) {
      if (!mounted.current || version !== generation.current) return;
      patch({ importing: false });
      window.alert(error.message);
    }
  };

  return { ...state, legacyName: state.legacy ? characterName(state.legacy, system) : "",
    onChange, replaceForm, undo, redo, save, clear, newSheet, reload, importLegacy, startEmpty, logout, remove, exportFile, importFile };
}
