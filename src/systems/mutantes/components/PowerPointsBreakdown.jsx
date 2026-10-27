import React from "react";

export const formatPowerPoints = (points) => Number(points).toLocaleString("pt-BR", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

function PointEntries({ entries }) {
  return entries.length ? (
    <ul>{entries.map((entry, index) => (
      <li key={`${entry.label}-${index}`}>
        <span>{entry.label}</span><strong>{formatPowerPoints(entry.points)} PP</strong>
      </li>
    ))}</ul>
  ) : <p>Sem pontos gastos nesta categoria.</p>;
}

export function PowerPointsBreakdown({ derived, expanded = false }) {
  return (
    <div className="mutantes-points-breakdown">
      {derived.powerPointBreakdown.map((group) => {
        const heading = <h3><span>{group.label}</span><strong>{formatPowerPoints(group.points)} PP</strong></h3>;
        return expanded ? (
          <section className="print-points-group" key={group.label}>
            {heading}
            <PointEntries entries={group.entries} />
          </section>
        ) : (
          <details key={group.label}>
            <summary>{heading}</summary>
            <PointEntries entries={group.entries} />
          </details>
        );
      })}
      <p className="mutantes-points-total">
        <span>Total usado</span><strong>{formatPowerPoints(derived.powerPointsUsed)} PP</strong>
      </p>
    </div>
  );
}
