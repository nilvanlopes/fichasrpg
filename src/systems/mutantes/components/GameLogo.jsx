import React from "react";
import { mutantes } from "../definition.js";

export function GameLogo() {
  return (
    <img
      className="game-logo"
      src={mutantes.logo.src}
      alt="Mutantes & Malfeitores"
    />
  );
}
