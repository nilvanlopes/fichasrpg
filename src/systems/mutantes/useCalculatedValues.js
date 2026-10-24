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

    // Custos de criação informados para a ficha. Bônus "aumentados" e
    // modificadores de perícia não entram aqui: podem vir de poderes/outros.
    const abilityPointEntries = abilities
      .map(({ key, label }) => ({ label, points: Math.max(0, numeric(form, key + "-base") - 10) }))
      .filter(({ points }) => points !== 0);
    const abilityPoints = abilityPointEntries.reduce((sum, entry) => sum + entry.points, 0);
    const savePointEntries = [
      ["Resistência", "resistencia"],
      ["Fortitude", "fortitude"],
      ["Reflexo", "reflexo"],
      ["Vontade", "vontade"],
    ].map(([label, key]) => ({ label, points: numeric(form, key + "-base") })).filter(({ points }) => points !== 0);
    const savePoints = savePointEntries.reduce((sum, entry) => sum + entry.points, 0);
    const defensePoints = numeric(form, "defesa-base") * 2;
    const defensePointEntries = defensePoints ? [{ label: "Defesa bônus base × 2", points: defensePoints }] : [];
    const attackPointEntries = [
      { label: "Ataque corpo a corpo", points: numeric(form, "ataque-corpo-corpo") },
      { label: "Ataque à distância", points: numeric(form, "ataque-distancia") },
    ].filter(({ points }) => points !== 0);
    const attackPoints = attackPointEntries.reduce((sum, entry) => sum + entry.points, 0);
    const standardFeatSlots = Array.from({ length: 16 }, (_, index) => index + 1)
      .flatMap((number) => ["", "b"].map((suffix) => ({
        nameField: `feito-${number}${suffix}-nome`,
        rankField: `feito-${number}${suffix}-graduacao`,
      })));
    const extraFeatSlots = Object.keys(form)
      .filter((name) => /^feito-extra-\d+-nome$/.test(name))
      .map((nameField) => ({ nameField, rankField: nameField.replace(/-nome$/, "-graduacao") }));
    const featPointEntries = [...standardFeatSlots, ...extraFeatSlots].flatMap(({ nameField, rankField }) => {
        const name = form[nameField];
        if (!String(name || "").trim()) return [];
        const points = Number(form[rankField] || 1) || 0;
        return points ? [{ label: String(name).trim(), points }] : [];
      });
    const featPoints = featPointEntries.reduce((sum, entry) => sum + entry.points, 0);
    const skillPointEntries = skills.flatMap(([label], index) => {
      const points = numeric(form, `skill-${index + 1}-rank`) / 4;
      return points ? [{ label: `${label} (graduação ${index + 1})`, points }] : [];
    });
    const skillPoints = skillPointEntries.reduce((sum, entry) => sum + entry.points, 0);
    const powerPointEntries = Array.from({ length: 7 }, (_, index) => {
      const number = index + 1;
      const points = numeric(form, `poder-${number}-custo`);
      return points ? { label: String(form[`poder-${number}-nome`] || `Poder ${number}`).trim(), points } : null;
    }).filter(Boolean);
    const powersPoints = powerPointEntries.reduce((sum, entry) => sum + entry.points, 0);
    const powerPointBreakdown = [
      { label: "Habilidades", points: abilityPoints, entries: abilityPointEntries },
      { label: "Salvamentos", points: savePoints, entries: savePointEntries },
      { label: "Defesa", points: defensePoints, entries: defensePointEntries },
      { label: "Ataques", points: attackPoints, entries: attackPointEntries },
      { label: "Feitos", points: featPoints, entries: featPointEntries },
      { label: "Perícias", points: skillPoints, entries: skillPointEntries },
      { label: "Poderes", points: powersPoints, entries: powerPointEntries },
    ];
    const powerPointsUsed = abilityPoints + savePoints + defensePoints + attackPoints + featPoints + skillPoints + powersPoints;
    const powerPointsTotal = Number(form["pontos-poder"] || form["pontos-poder-p2"] || 0);
    const powerLevel = powerPointsTotal > 0 ? Math.floor(powerPointsTotal / 15) : "";
    const limit = Number(powerLevel || 0) * 2;
    const makeLimitCheck = (key, label, left, right, leftName, rightName) => {
      const sum = Number(left || 0) + Number(right || 0);
      const exceeded = limit > 0 && sum > limit && left !== "" && right !== "";
      return {
        key,
        exceeded,
        message: `${leftName} (${left}) + ${rightName} (${right}) = ${sum}. O limite para NP ${powerLevel} é ${limit}.`,
      };
    };
    const limitChecks = {
      defenseResistance: makeLimitCheck("defenseResistance", "Defesa + Resistência", String(defenseHasValue ? numeric(form, "defesa-base") + numeric(form, "defesa-outros") - numeric(form, "defesa-desprevenido") : ""), String(saves.resistencia ?? ""), "Bônus de Defesa", "Resistência"),
      fortitudeWill: makeLimitCheck("fortitudeWill", "Fortitude + Vontade", String(saves.fortitude ?? ""), String(saves.vontade ?? ""), "Fortitude", "Vontade"),
      meleeAttackDamage: makeLimitCheck("meleeAttackDamage", "Ataque + Dano corpo a corpo", String(form["ataque-corpo-corpo"] ?? ""), String(form["dano-corpo-corpo"] ?? ""), "Ataque corpo a corpo", "Dano corpo a corpo"),
      rangedAttackDamage: makeLimitCheck("rangedAttackDamage", "Ataque + Dano à distância", String(form["ataque-distancia"] ?? ""), String(form["dano-distancia"] ?? ""), "Ataque à distância", "Dano à distância"),
    };

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
      powerPointsUsed,
      powerPointsTotal,
      powerLevel,
      maxSkillRanks: powerLevel === "" ? "" : Number(powerLevel) + 5,
      limitChecks,
      powerPointBreakdown,
    };
  }, [form]);
}
