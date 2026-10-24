import React from "react";
import "./form-fields.css";

export function LineField({ name, label, value, onChange, className = "", numeric = false, style }) {
  return (
    <input
      className={("line-input " + className).trim()}
      data-field={name}
      aria-label={label}
      inputMode={numeric ? "numeric" : undefined}
      style={style}
      value={value ?? ""}
      onChange={(event) => onChange(name, event.target.value, { typing: true, inputType: event.nativeEvent.inputType })}
    />
  );
}

export function TextField({ name, label, value, onChange, className = "" }) {
  return (
    <textarea
      className={className}
      data-field={name}
      aria-label={label}
      wrap="soft"
      value={value ?? ""}
      onChange={(event) => onChange(name, event.target.value, { typing: true, inputType: event.nativeEvent.inputType })}
    />
  );
}

export function CheckField({ name, label, value, onChange }) {
  return (
    <input
      className="check"
      type="checkbox"
      data-field={name}
      aria-label={label}
      checked={Boolean(value)}
      onChange={(event) => onChange(name, event.target.checked)}
    />
  );
}
