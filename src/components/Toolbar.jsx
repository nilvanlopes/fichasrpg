import React, { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api";

const icons = {
  save: "M5 4h12l3 3v13H4V4h1Zm2 0v6h10V4M7 20v-7h10v7",
  print: "M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v6H7zM18 11h.01",
  clear: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 3v7m4-7v7",
  reload: "M20 7v5h-5M4 17v-5h5m-4-2a7 7 0 0 1 12-4l3 3M4 14l3 3a7 7 0 0 0 12-4",
  export: "M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4",
  import: "M12 16V4m-5 5 5-5 5 5M5 17v4h14v-4",
  menu: "M4 6h16M4 12h16M4 18h16",
};

function Icon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icons[name]} /></svg>;
}

export function Toolbar({ onSave, onPrint, onClear, onReload, onLogout, onDelete, onExport, onImport, user, disabled, saving, deleting, importing,
  conflict, sheetId, sheetName, system }) {
  const [open, setOpen] = useState(false);
  const [sheetList, setSheetList] = useState({ items: [], loading: true, error: "" });
  const [listRefresh, setListRefresh] = useState(0);
  const touchStart = useRef(null);
  const importInput = useRef(null);

  useEffect(() => {
    if (!open || !user?.uid || !system) return undefined;
    let active = true;
    setSheetList({ items: [], loading: true, error: "" });
    apiRequest("/api/sheets").then(result => {
      if (!active) return;
      if (result.user.uid !== user.uid) {
        throw new Error("Sua conta mudou. Recarregue a página.");
      }
      setSheetList({ items: result.sheets.filter(sheet => sheet.system === system), loading: false, error: "" });
    }).catch(error => {
      if (active) setSheetList({ items: [], loading: false, error: error.message });
    });
    return () => { active = false; };
  }, [open, user?.uid, system, sheetId, listRefresh]);

  useEffect(() => {
    function start(event) {
      const touch = event.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    }
    function end(event) {
      if (!touchStart.current) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (open && dx < 0) setOpen(false);
        if (!open && touchStart.current.x < 32 && dx > 0) setOpen(true);
      }
      touchStart.current = null;
    }
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchend", end);
    };
  }, [open]);

  return (
    <>
      <button
        className="toolbar-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="sheet-actions"
        aria-label={open ? "Fechar menu de ações" : "Abrir menu de ações"}
        onClick={() => setOpen(!open)}
      >
        <Icon name="menu" /><span>Ações</span>
      </button>
      {open && <button className="toolbar-backdrop" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <nav id="sheet-actions" className={`toolbar${open ? " is-open" : ""}`} aria-label="Ações da ficha">
        <header className="toolbar-header">
          <a className="toolbar-home" href="/" aria-label="Voltar para Fichas RPG">
            <img src="/assets/rpg-favicon.svg" width="40" height="40" alt="" />
          </a>
          <button className="toolbar-close" type="button" onClick={() => setOpen(false)} aria-label="Fechar menu">×</button>
        </header>
        <div className="toolbar-content">
          <div className="toolbar-actions">
            <button type="button" onClick={onExport} disabled={disabled || deleting || importing}><Icon name="export" /><span>Exportar</span></button>
            <button type="button" onClick={() => importInput.current?.click()}
              disabled={disabled || saving || deleting || importing || conflict}>
              <Icon name="import" /><span>{importing ? "Importando…" : "Importar"}</span>
            </button>
            <button type="button" onClick={onPrint} disabled={disabled || deleting || importing}><Icon name="print" /><span>Imprimir</span></button>
            <button type="button" onClick={onClear} disabled={disabled || saving || deleting || importing || conflict}><Icon name="clear" /><span>Limpar</span></button>
            <button type="button" onClick={onReload} disabled={saving || deleting || importing}><Icon name="reload" /><span>Recarregar</span></button>
            <button className="primary" type="button" onClick={onSave} disabled={disabled || saving || deleting || importing || conflict}>
              <Icon name="save" /><span>{saving ? "Salvando…" : "Salvar"}</span>
            </button>
            <button className="toolbar-delete" type="button" onClick={onDelete} disabled={disabled || saving || deleting || importing || !user || !sheetId}>
              <Icon name="clear" /><span>{deleting ? "Excluindo…" : "Excluir ficha"}</span>
            </button>
            <input ref={importInput} type="file" hidden accept="application/json,.json" onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImport(file);
            }} />
          </div>
        {user && <section className="toolbar-sheets" aria-label="Fichas deste sistema">
          {sheetList.loading ? <p role="status">Carregando fichas…</p> : sheetList.error ? (
            <>
              <p role="alert">{sheetList.error}</p>
              <button type="button" onClick={() => setListRefresh(value => value + 1)}>Tentar novamente</button>
            </>
          ) : sheetList.items.length === 0 ? <p>Nenhuma ficha neste sistema.</p> : (
            <ul>
              {sheetList.items.map(sheet => (
                <li key={sheet.id}>
                  <a href={`/sistemas/${system}/${encodeURIComponent(sheet.id)}`}
                    aria-current={sheet.id === sheetId ? "page" : undefined}
                    aria-disabled={deleting || importing || undefined}
                    onClick={event => {
                      if (deleting || importing || sheet.id === sheetId) event.preventDefault();
                      if (!deleting && !importing) setOpen(false);
                    }}>
                    {sheet.id === sheetId ? sheetName || sheet.name : sheet.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>}
        </div>
        {user && <div className="account-label">
          <span>Conectado como <strong>{user.username}</strong></span>
          <button className="toolbar-logout" type="button" onClick={onLogout} disabled={deleting || importing}>Sair</button>
        </div>}
      </nav>
    </>
  );
}
