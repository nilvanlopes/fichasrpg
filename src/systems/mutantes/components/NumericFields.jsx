import React from "react";

export function BoxField({
  name,
  label,
  value,
  onChange,
  className = "",
  readOnly = false,
}) {
  return (
    <input
      className={("box-input " + (readOnly ? "readonly " : "") + className).trim()}
      data-field={name}
      aria-label={label}
      inputMode="numeric"
      value={value ?? ""}
      readOnly={readOnly}
      onChange={(event) => onChange(name, event.target.value, { typing: true, inputType: event.nativeEvent.inputType })}
    />
  );
}

export function MiniField({ name, label, value, onChange, readOnly = false }) {
  return (
    <input
      className={"mini-input" + (readOnly ? " readonly" : "")}
      data-field={name}
      aria-label={label}
      inputMode="numeric"
      value={value ?? ""}
      readOnly={readOnly}
      onChange={(event) => onChange(name, event.target.value, { typing: true, inputType: event.nativeEvent.inputType })}
    />
  );
}
