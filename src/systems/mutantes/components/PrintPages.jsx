import React from "react";
import { featCatalog } from "../featsCatalog";
import { PowersPanel } from "./PowersPanel";
import { PowerPointsBreakdown, formatPowerPoints } from "./PowerPointsBreakdown";

const Footer = () => (
  <div className="page-footer">©2005 Green Ronin Publishing LLC. Todos os direitos reservados. É permitido reproduzir esta página para uso pessoal.</div>
);

const normalizeName = (name) => String(name || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("pt-BR");

function getOwnedFeats(form) {
  const slots = Array.from({ length: 16 }, (_, index) => index + 1).flatMap((number) => [
    { nameField: `feito-${number}-nome`, benefitField: `feito-${number}-beneficio`, rankField: `feito-${number}-graduacao` },
    { nameField: `feito-${number}b-nome`, benefitField: `feito-${number}b-beneficio`, rankField: `feito-${number}b-graduacao` },
  ]);
  const extraNumbers = Object.keys(form)
    .map((name) => name.match(/^feito-extra-(\d+)-nome$/))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const lastExtra = extraNumbers.length ? Math.max(...extraNumbers) : 0;
  for (let number = 1; number <= lastExtra; number += 1) {
    slots.push({
      nameField: `feito-extra-${number}-nome`,
      benefitField: `feito-extra-${number}-beneficio`,
      rankField: `feito-extra-${number}-graduacao`,
    });
  }

  const seen = new Set();
  return slots.flatMap((slot) => {
    const name = String(form[slot.nameField] || "").trim();
    const key = normalizeName(name);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const feat = featCatalog.find((item) => normalizeName(item.name) === key);
    return [{
      ...slot,
      name,
      category: feat?.category || "",
      description: feat?.description || form[slot.benefitField] || "Descrição não cadastrada.",
      ranks: String(form[slot.rankField] || "1"),
    }];
  }).sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }));
}

function PrintableFeatsPage({ feats }) {
  return (
    <section className="sheet-page print-only-page print-feats-page" aria-label="Feitos">
      <section className="panel print-feats-panel" aria-label="Feitos">
        <h2 className="section-title">Feitos</h2>
        <div className="print-feat-list">
          {feats.map((feat) => (
            <article className="feat-book-entry" key={feat.nameField}>
              <div className="feat-book-title">
                <span>{feat.name}</span>
                {feat.category && (
                  <span className="feat-book-meta">{feat.category} · {feat.ranks} {feat.ranks === "1" ? "graduação" : "graduações"}</span>
                )}
              </div>
              <p>{feat.description}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export function PrintPages({ form, derived, onChange }) {
  const feats = getOwnedFeats(form);
  return (
    <>
      <section className="sheet-page print-only-page print-powers-page" aria-label="Poderes e dispositivos">
        <PowersPanel form={form} onChange={onChange} />
        <Footer />
      </section>
      {feats.length > 0 && <PrintableFeatsPage feats={feats} />}
      <section className="sheet-page print-only-page print-points-page" aria-label="Detalhamento dos pontos de poder">
        <h2 className="section-title">Pontos de poder</h2>
        <p className="print-points-budget">Total da ficha: <strong>{formatPowerPoints(derived.powerPointsTotal)} PP</strong></p>
        <PowerPointsBreakdown derived={derived} expanded />
      </section>
    </>
  );
}
