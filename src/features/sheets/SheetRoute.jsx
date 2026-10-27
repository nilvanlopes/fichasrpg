import React from "react";
import { getSystem } from "../../systems/registry.js";
import { MutantesEditor } from "../../systems/mutantes/MutantesEditor";
import { VampireEditor } from "../../systems/vampiro/VampireEditor";
import { useRpgSheet } from "./useRpgSheet.js";

const editors = { mutantes: MutantesEditor, vampiro: VampireEditor };

function SheetEditor({ system, sheetId, Editor }) {
  const sheet = useRpgSheet(sheetId, system);
  return <Editor sheet={sheet} />;
}

export function SheetRoute({ system, sheetId }) {
  if (!getSystem(system)) {
    return <main className="account-notice"><h1>Sistema não encontrado</h1><a href="/fichas">Voltar às fichas</a></main>;
  }
  return <SheetEditor key={`${system}/${sheetId}`} system={system} sheetId={sheetId} Editor={editors[system]} />;
}
