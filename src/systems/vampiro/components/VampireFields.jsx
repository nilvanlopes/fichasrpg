import React from "react";
import { LineField } from "../../../shared/ui/FormField";
import { nextTrackValue, trackValue } from "../data.js";

export function VampireField({ name, label, form, onChange, numeric = false }) {
  return (
    <label className="vampire-field">
      <span>{label}</span>
      <LineField name={name} label={label} value={form[name]} onChange={onChange} numeric={numeric} />
    </label>
  );
}

export function DotRating({ fields, label, form, onChange }) {
  const points = fields.reduce((total, name, index) => form[name] ? index + 1 : total, 0);
  const advance = () => {
    const next = (points + 1) % (fields.length + 1);
    fields.forEach((name, index) => onChange(name, index < next));
  };

  return (
    <button type="button" className="vampire-dots" aria-label={`${label}: ${points} de ${fields.length} pontos`}
      title="Clique para aumentar um ponto; após o máximo, limpa todos" onClick={advance}>
      {fields.map(name => (
        <span className="vampire-dot" key={name} aria-hidden="true">
          <span className="check" data-field={name} data-checked={Boolean(form[name])} />
        </span>
      ))}
    </button>
  );
}

const stateLabels = {
  damage: { 1: "Vazio", 2: "Uma marca", 3: "Cruzado", 4: "Preenchido" },
  hunger: { 1: "Vazio", 4: "Marcado" },
  humanity: { 1: "Vazio", 2: "Mácula", 4: "Marcado" },
};

function TrackMark({ value }) {
  return (
    <svg className="vampire-track-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none">
      <rect x="1" y="1" width="22" height="22" fill={value === "4" ? "currentColor" : "none"} />
      {(value === "2" || value === "3") && <path d="M2 22 22 2" />}
      {value === "3" && <path d="M2 2 22 22" />}
    </svg>
  );
}

export function StateTrack({ fields, label, kind = "damage", form, onChange }) {
  return (
    <div className="vampire-track-panel">
      <h3>{label}</h3>
      <div className="vampire-track" role="group" aria-label={label} style={{ "--track-length": fields.length }}>
        {fields.map((name, index) => {
          const value = trackValue(form[name], kind);
          const description = `${label}: posição ${index + 1}, ${stateLabels[kind][value]}`;
          return (
            <button key={name} type="button" data-field={name} data-state={value} aria-label={description} title={description}
              onClick={() => onChange(name, nextTrackValue(form[name], kind))}>
              <TrackMark value={value} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VampirePanel({ title, id, children, className = "" }) {
  return (
    <section className={`vampire-panel ${className}`.trim()} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="vampire-panel-body">{children}</div>
    </section>
  );
}
