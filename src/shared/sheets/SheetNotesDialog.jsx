import React from "react";
import { TextField } from "../ui/FormField";

export function SheetNotesDialog({ dialogRef, value, onChange, disabled = false, className = "", name = "anotacoes", title = "Anotações" }) {
  const titleId = `${name}-notes-title`;
  return (
    <dialog ref={dialogRef} className={`sheet-notes-dialog ${className}`.trim()} aria-labelledby={titleId}>
      <header className="sheet-notes-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Fechar anotações">×</button>
      </header>
      <fieldset className="sheet-fields" disabled={disabled}>
        <TextField name={name} label={title} value={value} onChange={onChange} />
      </fieldset>
    </dialog>
  );
}
