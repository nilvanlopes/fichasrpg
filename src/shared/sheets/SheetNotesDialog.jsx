import React from "react";
import { TextField } from "../ui/FormField";

export function SheetNotesDialog({ dialogRef, value, onChange, disabled = false, className = "" }) {
  return (
    <dialog ref={dialogRef} className={`sheet-notes-dialog ${className}`.trim()} aria-labelledby="sheet-notes-title">
      <header className="sheet-notes-header">
        <h2 id="sheet-notes-title">Anotações</h2>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Fechar anotações">×</button>
      </header>
      <fieldset className="sheet-fields" disabled={disabled}>
        <TextField name="anotacoes" label="Anotações" value={value} onChange={onChange} />
      </fieldset>
    </dialog>
  );
}
