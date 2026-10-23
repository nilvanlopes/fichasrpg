import React from "react";
import { getSystem } from "../../systems/registry.js";

export function SystemLogo({ system }) {
  const definition = getSystem(system);
  if (!definition) return null;
  const { label, logo } = definition;
  return logo.viewBox ? (
    <svg viewBox={logo.viewBox} role="img" aria-label={label}>
      <image href={logo.src} width={logo.width} height={logo.height} />
    </svg>
  ) : <img src={logo.src} alt={label} />;
}
