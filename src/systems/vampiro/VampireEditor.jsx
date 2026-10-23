import React, { useRef } from "react";
import { SheetEditorLayout } from "../../shared/sheets/SheetEditorLayout";
import { SheetNotesDialog } from "../../shared/sheets/SheetNotesDialog";
import { VampireAttributes, VampireIdentity, VampireSkills } from "./components/VampireTraits";
import { VampireBackgrounds, VampireBlood } from "./components/VampireSupernatural";
import { VampireDisciplines } from "./components/VampireDisciplines";
import "./vampire.css";

export function VampireEditor({ sheet }) {
  const notesRef = useRef(null);
  const fields = { form: sheet.form, onChange: sheet.onChange };
  const dark = (sheet.form["vampire-theme"] ?? sheet.form.tema) === "dark";
  return (
    <>
      <SheetEditorLayout sheet={sheet} system="vampiro" onNotes={() => notesRef.current?.showModal()} actions={
        <button type="button" title={dark ? "Ativar tema claro" : "Ativar tema escuro"}
          disabled={sheet.failure === "SHEET_CONFLICT" || sheet.importing || sheet.deleting}
          onClick={() => sheet.onChange("vampire-theme", dark ? "light" : "dark")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {dark ? <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
            </> : <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />}
          </svg>
          <span>{dark ? "Tema claro" : "Tema escuro"}</span>
        </button>
      }>
        <main className={`vampire-root${dark ? " dark" : ""}`} aria-labelledby="vampire-title">
          <div className="vampire-paper">
            <div className="vampire-paper-frame" aria-hidden="true" />
            <div className="vampire-paper-content">
              <h1 id="vampire-title" className="vampire-sr-only">Vampiro: A Máscara — Ficha de personagem</h1>
              <VampireIdentity {...fields} />
              <VampireAttributes {...fields} />
              <VampireSkills {...fields} />
              <VampireDisciplines {...fields} disabled={sheet.failure === "SHEET_CONFLICT" || sheet.importing || sheet.deleting || Boolean(sheet.legacy)} />
              <VampireBlood {...fields} />
              <VampireBackgrounds {...fields} />
            </div>
          </div>
        </main>
      </SheetEditorLayout>
      {sheet.ready && <SheetNotesDialog dialogRef={notesRef} value={sheet.form.anotacoes} onChange={sheet.onChange}
        className={`vampire-notes-dialog${dark ? " dark" : ""}`}
        disabled={sheet.failure === "SHEET_CONFLICT" || sheet.importing || sheet.deleting} />}
    </>
  );
}
