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

export function LimitBoxField({ name, label, value, onChange, limitInfo, readOnly = true }) {
  const invalid = Boolean(limitInfo?.exceeded);
  const tooltipId = `limit-${name}-tooltip`;
  return (
    <span className={`limit-field${invalid ? " limit-field--invalid" : ""}`}>
      <input
        className={`box-input${readOnly ? " readonly" : ""}`}
        data-field={name}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? tooltipId : undefined}
        inputMode="numeric"
        value={value ?? ""}
        readOnly={readOnly}
        onFocus={(event) => {
          if (invalid) event.currentTarget.parentElement?.classList.add("limit-field--open");
        }}
        onBlur={(event) => event.currentTarget.parentElement?.classList.remove("limit-field--open")}
        onClick={(event) => {
          if (invalid) event.currentTarget.parentElement?.classList.add("limit-field--open");
        }}
        onChange={(event) => onChange?.(name, event.target.value, { typing: true, inputType: event.nativeEvent.inputType })}
      />
      {invalid && <span className="limit-tooltip" id={tooltipId} role="tooltip">{limitInfo.message}</span>}
    </span>
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
