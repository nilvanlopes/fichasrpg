import { useMemo } from "react";
import { abilities, skills } from "./data.js";

function numeric(form, name) {
  return Number(form[name] || 0);
}

function filled(form, name) {
  return (form[name] ?? "") !== "";
}

export function useCalculatedValues(form) {
  return useMemo(() => {
    const calculatedAbilities = {};

    abilities.forEach(({ key }) => {
      const hasValue = filled(form, key + "-base") || filled(form, key + "-aumentado");
      if (!hasValue) {
        calculatedAbilities[key] = { total: "", mod: "" };
        return;
      }
      const total = numeric(form, key + "-base") + numeric(form, key + "-aumentado");
      const modifier = Math.floor((total - 10) / 2);
      calculatedAbilities[key] = {
        total,
        mod: (modifier >= 0 ? "+" : "") + modifier,
      };
    });

    const saves = {};
    [
      ["resistencia", "con"],
      ["fortitude", "con"],
      ["reflexo", "des"],
      ["vontade", "sab"],
    ].forEach(([name, ability]) => {
      const hasValue =
        filled(form, name + "-base") ||
        filled(form, ability + "-base") ||
        filled(form, ability + "-aumentado") ||
        filled(form, name + "-outros");
      saves[name] = hasValue
        ? numeric(form, name + "-base") +
          Number(calculatedAbilities[ability].mod || 0) +
          numeric(form, name + "-outros")
        : "";
    });

    const defenseHasValue = ["base", "outros", "desprevenido"].some(
      (part) => filled(form, "defesa-" + part),
    );
    const initiativeHasValue = ["dex", "feito", "poder"].some(
      (part) => filled(form, "iniciativa-" + part),
    );

    const skillBonuses = skills.map(([, ability], index) => {
      const number = index + 1;
      const rankName = "skill-" + number + "-rank";
      const otherName = "skill-" + number + "-other";
      const abilityKey = { FOR: "for", DES: "des", CON: "con", INT: "int", SAB: "sab", CAR: "car" }[ability];
      const abilityModifier = abilityKey ? Number(calculatedAbilities[abilityKey].mod || 0) : 0;
      return numeric(form, rankName) + numeric(form, otherName) + abilityModifier;
    });

    return {
      abilities: calculatedAbilities,
      abilitiesList: abilities,
      saves,
      defense: defenseHasValue
        ? 10 +
          numeric(form, "defesa-base") +
          numeric(form, "defesa-outros") -
          numeric(form, "defesa-desprevenido")
        : "",
      initiative: initiativeHasValue
        ? numeric(form, "iniciativa-dex") +
          numeric(form, "iniciativa-feito") +
          numeric(form, "iniciativa-poder")
        : "",
      skillBonuses,
    };
  }, [form]);
}
