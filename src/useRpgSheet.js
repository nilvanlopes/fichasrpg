import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, writeHeaders } from "./api";
import { downloadSheet, parseSheetFile } from "./sheetFiles.js";

const LEGACY_MUTANTES_KEY = "ficha-mutantes-malfeitores-react-v1";

function legacyMutantesForm(user, form) {
  if (user?.username !== "pyu" || Object.keys(form || {}).length) return null;
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_MUTANTES_KEY) || "null");
    return legacy && typeof legacy === "object" && !Array.isArray(legacy) && Object.keys(legacy).length
      ? legacy
      : null;
  } catch {
    return null;
  }
}

export function useRpgSheet(sheetId, system) {
  const [state, setState] = useState({
    sheet: null, user: null, form: {}, revision: 0, ready: false, loading: true,
    dirty: false, saving: false, deleting: false, importing: false, failure: "", status: "Carregando ficha…", legacy: null,
  });
  const current = useRef(state);
  const persistedId = useRef(sheetId === "nova" ? null : sheetId);
  const generation = useRef(0);
  const mounted = useRef(false);
  const patch = useCallback(values => {
    current.current = { ...current.current, ...values };
    if (mounted.current) setState(current.current);
  }, []);

  const load = useCallback(async () => {
    const version = ++generation.current;
    patch({ sheet: null, user: null, form: {}, ready: false, loading: true, dirty: false,
      saving: false, deleting: false, importing: false, failure: "", legacy: null, status: "Carregando ficha…" });
    try {
      let user, sheet;
      if (persistedId.current) {
        ({ user, sheet } = await apiRequest(`/api/sheets/${encodeURIComponent(persistedId.current)}`));
      } else {
        ({ user } = await apiRequest("/api/session"));
        sheet = {
          id: null, system, form: {}, revision: 0,
          name: system === "vampiro" ? "Nova ficha de Vampiro: A Máscara" : "Nova ficha de Mutantes & Malfeitores",
        };
      }
      if (!mounted.current || version !== generation.current) return;
      patch({ sheet, user, form: sheet.form, revision: sheet.revision, ready: true, loading: false,
        status: sheet.id ? "Ficha carregada da sua conta." : "Nova ficha. Clique em Salvar para criá-la.",
        legacy: sheet.system === "mutantes" ? legacyMutantesForm(user, sheet.form) : null });
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
    patch({ saving: true, failure: "", status: "Salvando na sua conta…" });
    try {
      const isNew = !snapshot.sheet.id;
      const characterName = snapshot.form[snapshot.sheet.system === "vampiro" ? "nome" : "nome-personagem"];
      const name = isNew && typeof characterName === "string" && characterName.trim()
        ? characterName.trim().slice(0, 120) : snapshot.sheet.name;
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
      const dirty = current.current.form !== snapshot.form || current.current.sheet?.name !== snapshot.sheet.name;
      patch({ sheet: { ...snapshot.sheet, ...sheet }, revision: sheet.revision, saving: false,
        dirty, legacy: null, status: dirty ? "Alterações pendentes…" : "Salvo na sua conta." });
    } catch (error) {
      if (!mounted.current || version !== generation.current) return;
      if (["LOGIN_REQUIRED", "ACCESS_DENIED"].includes(error.code)) {
        patch({ ready: false, user: null, form: {}, dirty: false, legacy: null });
      }
      patch({ saving: false, failure: error.code, status: error.message });
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
          patch({ ready: false, user: null, form: {}, dirty: false, saving: false,
            legacy: null, failure: error.code, status: error.message });
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

  const onChange = useCallback((name, value) => {
    const snapshot = current.current;
    if (!snapshot.ready) return;
    patch({ form: { ...snapshot.form, [name]: value }, dirty: true, legacy: null,
      failure: snapshot.failure === "SHEET_CONFLICT" ? snapshot.failure : "",
      status: snapshot.failure === "SHEET_CONFLICT" ? snapshot.status : "Alterações pendentes…" });
  }, [patch]);

  const replaceForm = useCallback(form => {
    if (!current.current.ready) return;
    patch({ form, dirty: true, legacy: null, failure: "", status: "Alterações pendentes…" });
  }, [patch]);

  const rename = useCallback(name => {
    if (!current.current.ready || typeof name !== "string" || name.length > 120) return;
    const sheet = { ...current.current.sheet, name };
    const conflicted = current.current.failure === "SHEET_CONFLICT";
    patch({ sheet, dirty: true, failure: conflicted ? "SHEET_CONFLICT" : "",
      status: conflicted ? current.current.status : "Alterações pendentes…" });
  }, [patch]);

  const clear = () => {
    if (window.confirm("Limpar todos os campos desta ficha?")) replaceForm({});
  };
  const reload = () => {
    const message = current.current.sheet?.id
      ? "Recarregar a ficha do banco e descartar as alterações ainda não salvas?"
      : "Descartar as alterações desta ficha ainda não salva?";
    if (!current.current.saving && (!current.current.dirty || window.confirm(message))) load();
  };
  const importLegacy = () => {
    const snapshot = current.current;
    if (snapshot.user?.username === "pyu" && snapshot.legacy) replaceForm(snapshot.legacy);
  };
  const startEmpty = () => replaceForm({});
  const logout = () => {
    if (!current.current.dirty || window.confirm("Sair com alterações ainda não salvas?")) {
      generation.current += 1;
      patch({ ready: false, form: {}, user: null, dirty: false });
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
      window.location.assign("/");
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
      window.history.replaceState(null, "", `/sistemas/${sheet.system}/${sheet.id}`);
      patch({ sheet, form: sheet.form, revision: sheet.revision, dirty: false, importing: false,
        failure: "", legacy: null, status: "Ficha importada para sua conta." });
    } catch (error) {
      if (!mounted.current || version !== generation.current) return;
      patch({ importing: false });
      window.alert(error.message);
    }
  };

  return { ...state, onChange, replaceForm, rename, save, clear, reload, importLegacy, startEmpty, logout, remove, exportFile, importFile };
}
