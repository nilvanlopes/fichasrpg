import React from "react";
import { CharacterPage } from "./components/CharacterPage";
import { CampaignPage } from "./components/CampaignPage";
import { SheetEditorLayout } from "../../shared/sheets/SheetEditorLayout";
import { useCalculatedValues } from "./useCalculatedValues.js";
import "./mutantes.css";

export function MutantesEditor({ sheet }) {
  const derived = useCalculatedValues(sheet.form);
  return (
    <SheetEditorLayout sheet={sheet} system="mutantes">
      <main className="mutantes-root sheets">
        <CharacterPage form={sheet.form} derived={derived} onChange={sheet.onChange} />
        <CampaignPage form={sheet.form} derived={derived} onChange={sheet.onChange} />
      </main>
    </SheetEditorLayout>
  );
}
