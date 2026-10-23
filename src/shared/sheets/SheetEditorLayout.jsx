import React from "react";
import "./sheets.css";
import { Toolbar } from "./Toolbar";

export function SheetEditorLayout({ sheet, system, actions, onNotes, children }) {
  const conflict = sheet.failure === "SHEET_CONFLICT";
  return (
    <>
      <Toolbar
        onSave={sheet.save} onPrint={() => window.print()} onClear={sheet.clear} onNew={sheet.newSheet}
        onUndo={sheet.undo} onRedo={sheet.redo} canUndo={sheet.canUndo} canRedo={sheet.canRedo}
        onReload={sheet.reload} onLogout={sheet.logout} onExport={sheet.exportFile} onImport={sheet.importFile}
        importing={sheet.importing} onDelete={sheet.remove} deleting={sheet.deleting}
        sheetId={sheet.sheet?.id} sheetName={sheet.sheet?.name} system={system} user={sheet.user}
        disabled={!sheet.ready || Boolean(sheet.legacy)} saving={sheet.saving} conflict={conflict}
        actions={sheet.ready ? actions : null}
        error={sheet.ready && sheet.failure && !conflict ? sheet.status : ""}
        onNotes={sheet.ready ? onNotes : undefined}
      />
      {!sheet.ready ? (
        <section className="account-notice" aria-live="polite">
          <h1>{sheet.loading ? "Carregando sua ficha…" : "Não foi possível abrir sua ficha"}</h1>
          <p>{sheet.status}</p>
          {!sheet.loading && (["LOGIN_REQUIRED", "ACCESS_DENIED"].includes(sheet.failure)
            ? <a href="/outpost.goauthentik.io/start">Entrar com sua conta</a>
            : <button type="button" onClick={sheet.reload}>Tentar novamente</button>)}
        </section>
      ) : (
        <>
          {sheet.legacy && (
            <section className="account-notice" aria-label="Importar ficha anterior">
              <p>Há uma ficha antiga salva neste navegador{sheet.legacyName ? `: ${sheet.legacyName}` : ""}. Deseja importá-la para a conta <strong>{sheet.user.username}</strong>?</p>
              <button type="button" onClick={sheet.importLegacy}>Importar para minha conta</button>
              <button type="button" onClick={sheet.startEmpty}>Começar com ficha vazia</button>
            </section>
          )}
          {conflict && (
            <section className="account-notice" role="alert">
              <p>{sheet.status}</p>
              <button type="button" onClick={sheet.reload}>Recarregar ficha</button>
            </section>
          )}
          <fieldset className="sheet-fields" aria-label="Campos da ficha"
            disabled={sheet.importing || sheet.deleting || Boolean(sheet.legacy) || conflict}>
            {children}
          </fieldset>
        </>
      )}
    </>
  );
}
