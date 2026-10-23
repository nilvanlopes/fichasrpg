import React, { useEffect, useLayoutEffect, useRef } from "react";

const ruleSections = [
  ["amalgam", "Amálgama"], ["prerequisite", "Pré-requisito"], ["cost", "Custo"],
  ["activationCost", "Custo de ativação"], ["dicePool", "Parada de dados (Dice Pools)"],
  ["ingredients", "Ingredientes"], ["system", "Sistema (System)"], ["duration", "Duração"],
  ["athanorCorporis", "Athanor Corporis"], ["calcinatio", "Calcinatio"],
];

export function VampirePowerCard({ anchor, name, discipline, power, alchemy, loading, error, onRetry, onClose, onReplace, onRemove, onMethod }) {
  const cardRef = useRef(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card.matches(":popover-open")) card.showPopover();
    const bounds = card.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.x + 4, window.innerWidth - bounds.width - 8));
    const top = Math.max(8, Math.min(anchor.y + 4, window.innerHeight - bounds.height - 8));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }, [anchor, power, loading, error]);

  useEffect(() => {
    cardRef.current.querySelector(".vampire-power-card-content").focus({ preventScroll: true });
    const dismiss = () => onClose();
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("resize", dismiss);
    };
  }, [onClose]);

  return (
    <div ref={cardRef} popover="auto" className="vampire-power-card" role="dialog" tabIndex={-1}
      aria-labelledby="vampire-power-card-title" onBeforeToggle={event => {
        if (event.newState === "closed") onClose();
      }} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); onClose(true); }
      }}>
      <header>
        <div>
          <h3 id="vampire-power-card-title">{name}</h3>
          <p>{discipline}{power ? ` · Nível ${alchemy?.copied ? power.level + 1 : power.level}` : ""}</p>
        </div>
        <button type="button" aria-label="Fechar detalhes do poder" onClick={() => onClose(true)}>×</button>
      </header>
      <div className="vampire-power-card-content" role="region" aria-label="Regras do poder" tabIndex={0} aria-busy={loading}>
        {loading && <p role="status">Carregando poder…</p>}
        {error && <div role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Tentar novamente</button></div>}
        {!loading && !error && !power && <p>Não há detalhes cadastrados para este poder.</p>}
        {alchemy && <div className="vampire-formula-info">
          {alchemy.copied && <>
            <p className="vampire-formula-badge">Copied via Thin-Blood Alchemy</p>
            <p>Disciplina de origem: {alchemy.source}{power ? ` · Nível ${power.level}` : ""}</p>
            <p>Use a graduação de Thin-Blood Alchemy no lugar da disciplina de origem para esta fórmula.</p>
          </>}
          <p><strong>Método de destilação:</strong> {alchemy.method || "Não informado"}</p>
        </div>}
        {power && <>
          {power.description && <p className="vampire-power-text">{power.description}</p>}
          <dl>
            {ruleSections.filter(([key]) => power.details?.[key]).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd className="vampire-power-text">{power.details[key]}</dd>
              </div>
            ))}
          </dl>
        </>}
      </div>
      <footer>
        <button type="button" onClick={onReplace}>Trocar poder</button>
        {onMethod && <button type="button" onClick={onMethod}>{alchemy?.method ? "Alterar método" : "Definir método"}</button>}
        <button type="button" onClick={onRemove}>Remover poder</button>
      </footer>
    </div>
  );
}
