import React, { useRef } from "react";
import { skills } from "../data";
import { LineField, TextField } from "../../../shared/ui/FormField";
import { SheetNotesDialog } from "../../../shared/sheets/SheetNotesDialog";
import { BoxField, MiniField } from "./NumericFields";

function CampaignInfo({ form, onChange }) {
  const heroesNoteRef = useRef(null);
  const partnersNoteRef = useRef(null);
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
            <label className="campaign-info-label">
              Pontos de poder{" "}
              <LineField name="pontos-poder" label="Pontos de poder" value={form["pontos-poder"]} onChange={onChange} numeric />
            </label>
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
            value={form["graduacoes-maximas"]}
            onChange={onChange}
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

export function CampaignPage({ form, derived, onChange }) {
  return (
    <section className="sheet-page page-two" aria-labelledby="campaign-title">
      <div className="campaign-layout">
        <div className="campaign-left">
          <CampaignInfo form={form} onChange={onChange} />
          <WritingPanel title="Equipamento" prefix="equipment" amount={16} form={form} onChange={onChange} />
          <WritingPanel title="Origem" prefix="origin" amount={13} form={form} onChange={onChange} />
          <WritingPanel title="Desvantagens & Complicações" prefix="disadvantage" amount={8} form={form} onChange={onChange} />
        </div>
        <div className="campaign-right">
          <SkillsPanel form={form} derived={derived} onChange={onChange} />
          <section className="panel drawing-panel" aria-labelledby="drawing-title">
            <h2 className="section-title" id="drawing-title">Desenho do personagem</h2>
            <TextField
              name="desenho"
              label="Desenho do personagem"
              value={form.desenho}
              onChange={onChange}
              className="drawing-space"
            />
          </section>
        </div>
      </div>
      <div className="page-footer">©2005 Green Ronin Publishing LLC. Todos os direitos reservados. É permitido reproduzir esta página para uso pessoal.</div>
    </section>
  );
}
