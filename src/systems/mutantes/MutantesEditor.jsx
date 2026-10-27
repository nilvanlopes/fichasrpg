import React, { useEffect, useRef } from "react";
import { CharacterPage } from "./components/CharacterPage";
import { CampaignPage } from "./components/CampaignPage";
import { PrintPages } from "./components/PrintPages";
import { SheetEditorLayout } from "../../shared/sheets/SheetEditorLayout";
import { useCalculatedValues } from "./useCalculatedValues.js";
import "./mutantes.css";

export function MutantesEditor({ sheet }) {
  const pointsBreakdownRef = useRef(null);
  const openPointsBreakdown = () => pointsBreakdownRef.current?.showModal();
  const derived = useCalculatedValues(sheet.form);
  const sheetName = String(sheet.form["nome-personagem"] || "").trim()
    || String(sheet.sheet?.name || "").trim()
    || "Ficha de Mutantes & Malfeitores";
  useEffect(() => {
    const previousTitle = document.title;
    return () => { document.title = previousTitle; };
  }, []);
  useEffect(() => {
    document.title = sheetName;
  }, [sheetName]);
  return (
    <SheetEditorLayout sheet={sheet} system="mutantes">
      <main className="mutantes-root sheets" spellCheck={false}>
        <CharacterPage form={sheet.form} derived={derived} onChange={sheet.onChange} onOpenPointsBreakdown={openPointsBreakdown} />
        <CampaignPage form={sheet.form} derived={derived} sheetId={sheet.sheet?.id} user={sheet.user}
          saving={sheet.saving} saveSheet={sheet.save} onChange={sheet.onChange} pointsBreakdownRef={pointsBreakdownRef} />
        <PrintPages form={sheet.form} derived={derived} onChange={sheet.onChange} />
      </main>
    </SheetEditorLayout>
  );
}
