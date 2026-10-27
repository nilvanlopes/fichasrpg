import React, { useRef } from "react";
import { CharacterPage } from "./components/CharacterPage";
import { CampaignPage } from "./components/CampaignPage";
import { SheetEditorLayout } from "../../shared/sheets/SheetEditorLayout";
import { useCalculatedValues } from "./useCalculatedValues.js";
import "./mutantes.css";

export function MutantesEditor({ sheet }) {
  const pointsBreakdownRef = useRef(null);
  const openPointsBreakdown = () => pointsBreakdownRef.current?.showModal();
  const derived = useCalculatedValues(sheet.form);
  return (
    <SheetEditorLayout sheet={sheet} system="mutantes">
      <main className="mutantes-root sheets" spellCheck={false}>
        <CharacterPage form={sheet.form} derived={derived} onChange={sheet.onChange} onOpenPointsBreakdown={openPointsBreakdown} />
        <CampaignPage form={sheet.form} derived={derived} sheetId={sheet.sheet?.id} user={sheet.user}
          saving={sheet.saving} saveSheet={sheet.save} onChange={sheet.onChange} pointsBreakdownRef={pointsBreakdownRef} />
      </main>
    </SheetEditorLayout>
  );
}
