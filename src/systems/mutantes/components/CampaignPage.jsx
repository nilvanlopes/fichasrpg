import React, { useRef, useState } from "react";
import { skills } from "../data";
import { LineField, TextField } from "../../../shared/ui/FormField";
import { SheetNotesDialog } from "../../../shared/sheets/SheetNotesDialog";
import { BoxField, MiniField } from "./NumericFields";
import { DrawingField } from "./DrawingField.jsx";

function CampaignInfo({ form, derived, onChange, pointsBreakdownRef }) {
  const heroesNoteRef = useRef(null);
  const partnersNoteRef = useRef(null);
  const [showPointAdder, setShowPointAdder] = useState(false);
  const [pointsToAdd, setPointsToAdd] = useState("1");
  const used = Number(derived.powerPointsUsed.toFixed(2));
  const formatPoints = (points) => String(points).replace(/\.5$/, ",5").replace(/\.25$/, ",25").replace(/\.75$/, ",75");
  const usedText = formatPoints(used);
  const totalPoints = form["pontos-poder"] || form["pontos-poder-p2"] || "";
  return (
    <>
      <section className="panel campaign-info" aria-labelledby="campaign-title">
        <h1 className="section-title" id="campaign-title">Informações sobre a campanha</h1>
        <div className="campaign-info-body">
          <div className="campaign-info-row">
            <label className="campaign-info-label">
              Campanha{" "}
              <LineField name="campanha" label="Campanha" value={form.campanha} onChange={onChange} />
            </label>
            <label className="campaign-info-label">
              Mestre{" "}
              <LineField name="mestre" label="Mestre" value={form.mestre} onChange={onChange} />
            </label>
            <div
              className="campaign-info-label power-points-total-label"
              role="group"
              tabIndex={0}
              aria-label={`Pontos de poder: ${usedText} usados de ${totalPoints || "total não definido"}. Abrir detalhamento por campo`}
              aria-haspopup="dialog"
              onClick={() => pointsBreakdownRef.current?.showModal()}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  pointsBreakdownRef.current?.showModal();
                }
              }}
            >
              <span>Pontos de poder</span>
              <span className="line-input power-points-used points-breakdown-trigger">{usedText}</span>
              <span aria-hidden="true">/</span>
              <LineField
                name="pontos-poder"
                label="Pontos de poder totais"
                value={totalPoints}
                onChange={onChange}
                numeric
                style={{ width: `${String(totalPoints).length + 1}ch`, flex: "0 0 auto" }}
              />
            </div>
          </div>
          <div className="campaign-info-row">
            <button className="campaign-info-label campaign-note-label" type="button" onClick={() => heroesNoteRef.current?.showModal()}>
              <span>Heróis amigos</span>
              <span className="campaign-note-preview">{form["herois-amigos"] || ""}</span>
            </button>
            <button className="campaign-info-label campaign-note-label" type="button" onClick={() => partnersNoteRef.current?.showModal()}>
              <span>Parceiros ou capangas</span>
              <span className="campaign-note-preview">{form.parceiros || ""}</span>
            </button>
            <label className="campaign-info-label">
              Arqui-inimigo{" "}
              <LineField name="arqui-inimigo" label="Arqui-inimigo" value={form["arqui-inimigo"]} onChange={onChange} />
            </label>
          </div>
        </div>
      </section>
      <SheetNotesDialog
        dialogRef={heroesNoteRef}
        name="herois-amigos"
        title="Heróis amigos"
        value={form["herois-amigos"]}
        onChange={onChange}
      />
      <SheetNotesDialog
        dialogRef={partnersNoteRef}
        name="parceiros"
        title="Parceiros ou capangas"
        value={form.parceiros}
        onChange={onChange}
      />
      <dialog ref={pointsBreakdownRef} className="mutantes-points-dialog" aria-labelledby="mutantes-points-title">
        <header>
          <div className="mutantes-points-header-title">
            <h2 id="mutantes-points-title">Pontos de poder</h2>
            <button
              type="button"
              aria-label="Adicionar ou remover pontos de poder"
              aria-expanded={showPointAdder}
              aria-controls="mutantes-points-adder"
              onClick={() => setShowPointAdder((open) => !open)}
            >+</button>
          </div>
          <div className="mutantes-points-header-actions">
            <button type="button" onClick={() => pointsBreakdownRef.current?.close()} aria-label="Fechar detalhamento">×</button>
          </div>
        </header>
        {showPointAdder && <div className="mutantes-points-adder" id="mutantes-points-adder">
          <label htmlFor="mutantes-points-to-add">Quantidade</label>
          <div className="mutantes-points-stepper">
            <button type="button" aria-label="Diminuir quantidade" onClick={() => setPointsToAdd(String((Number(pointsToAdd) || 0) - 1))}>−</button>
            <input
              id="mutantes-points-to-add"
              type="number"
              step="1"
              value={pointsToAdd}
              onChange={(event) => setPointsToAdd(event.target.value)}
            />
            <button type="button" aria-label="Aumentar quantidade" onClick={() => setPointsToAdd(String((Number(pointsToAdd) || 0) + 1))}>+</button>
          </div>
          <button
            className="mutantes-points-add-confirm"
            type="button"
            onClick={() => {
              const amount = Math.trunc(Number(pointsToAdd) || 0);
              onChange("pontos-poder", String((Number(totalPoints) || 0) + amount));
              setPointsToAdd("1");
              setShowPointAdder(false);
            }}
          >Adicionar</button>
        </div>}
        <div className="mutantes-points-breakdown">
          {derived.powerPointBreakdown.map((group) => (
            <details key={group.label}>
              <summary><h3><span>{group.label}</span><strong>{formatPoints(group.points)} PP</strong></h3></summary>
              {group.entries.length ? (
                <ul>{group.entries.map((entry, index) => (
                  <li key={`${entry.label}-${index}`}><span>{entry.label}</span><strong>{formatPoints(entry.points)} PP</strong></li>
                ))}</ul>
              ) : <p>Sem pontos gastos nesta categoria.</p>}
            </details>
          ))}
          <p className="mutantes-points-total"><span>Total usado</span><strong>{usedText} PP</strong></p>
        </div>
      </dialog>
    </>
  );
}

function WritingPanel({ title, prefix, amount, form, onChange, className = "" }) {
  const legacyLines = Array.from({ length: amount }, (_, index) => form[`${prefix}-${index + 1}`] ?? "");
  while (legacyLines.length && !String(legacyLines.at(-1)).trim()) legacyLines.pop();

  return (
    <section className={"panel writing-panel " + className} aria-label={title}>
      <h2 className="section-title">{title}</h2>
      <TextField
        name={prefix}
        label={title}
        value={form[prefix] ?? legacyLines.join("\n")}
        onChange={onChange}
        className="writing-textarea ruled-textarea"
      />
    </section>
  );
}

function SkillsPanel({ form, derived, onChange }) {
  return (
    <section className="panel skills-panel" aria-labelledby="skills-title">
      <div className="skills-title">
        <h2 className="section-title" id="skills-title">Perícias</h2>
        <label className="max-ranks">
          Graduações<br />máximas
          <BoxField
            name="graduacoes-maximas"
            label="Graduações máximas"
            value={derived.maxSkillRanks}
            onChange={onChange}
            readOnly
          />
        </label>
      </div>
      <div className="skills-head">
        <span />
        <span>Bônus de<br />perícia</span>
        <span>=</span>
        <span>Grad. na<br />perícia</span>
        <span>+</span>
        <span>Mod. de<br />habilidade</span>
        <span>+</span>
        <span>Outros</span>
      </div>
      <div className="skills-list">
        {skills.map(([label, ability, specialization], index) => {
          const number = index + 1;
          const specialtyField = `skill-${number}-specialty`;
          return (
            <div className="skill-row" key={number}>
              {specialization ? (
                <input
                  className="skill-name skill-specialty"
                  name={specialtyField}
                  data-field={specialtyField}
                  aria-label={`${specialization} ${index + 1} especialização`}
                  title={`Especifique ${specialization.toLocaleLowerCase("pt-BR")}`}
                  placeholder={specialization}
                  spellCheck={false}
                  value={form[specialtyField] ?? ""}
                  onChange={(event) => onChange(specialtyField, event.target.value, { typing: true, inputType: event.nativeEvent.inputType })}
                />
              ) : <span className="skill-name">{label}</span>}
              <MiniField name={"skill-" + number + "-bonus"} label={"Bônus " + label} value={derived.skillBonuses[index]} onChange={onChange} readOnly />
              <span className="operator">=</span>
              <MiniField name={"skill-" + number + "-rank"} label={"Graduação " + label} value={form["skill-" + number + "-rank"]} onChange={onChange} />
              <span className="operator">+</span>
              <span className="skill-ability">{ability}</span>
              <span className="operator">+</span>
              <MiniField name={"skill-" + number + "-other"} label={"Outros " + label} value={form["skill-" + number + "-other"]} onChange={onChange} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CampaignPage({ form, derived, sheetId, user, saving, saveSheet, onChange, pointsBreakdownRef }) {
  return (
    <section className="sheet-page page-two" aria-labelledby="campaign-title">
      <div className="campaign-layout">
        <div className="campaign-left">
          <CampaignInfo form={form} derived={derived} onChange={onChange} pointsBreakdownRef={pointsBreakdownRef} />
          <WritingPanel title="Equipamento" prefix="equipment" amount={16} form={form} onChange={onChange} />
          <WritingPanel title="Origem" prefix="origin" amount={13} form={form} onChange={onChange} />
          <WritingPanel title="Desvantagens & Complicações" prefix="disadvantage" amount={8} form={form} onChange={onChange} />
        </div>
        <div className="campaign-right">
          <SkillsPanel form={form} derived={derived} onChange={onChange} />
          <section className="panel drawing-panel" aria-labelledby="drawing-title">
            <h2 className="section-title" id="drawing-title">Desenho do personagem</h2>
            <DrawingField sheetId={sheetId} user={user} saving={saving} saveSheet={saveSheet}
              value={form.desenho} onChange={onChange} />
          </section>
        </div>
      </div>
      <div className="page-footer">©2005 Green Ronin Publishing LLC. Todos os direitos reservados. É permitido reproduzir esta página para uso pessoal.</div>
    </section>
  );
}
