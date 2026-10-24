import React from "react";
import { CheckField, LineField } from "../../../shared/ui/FormField";

function formatPoints(points) {
  return String(Number(points.toFixed(2)))
    .replace(/\.5$/, ",5")
    .replace(/\.25$/, ",25")
    .replace(/\.75$/, ",75");
}

function IdentityLabel({ children, name, label, form, onChange, numeric = false, calculated = false, value, className = "", onClick }) {
  const compactField = ["power-level-field", "power-points-field"].includes(className);
  const valueWidth = String(value ?? "").length + (className === "power-points-field" ? 0.7 : 2);
  const Wrapper = onClick ? "div" : "label";
  return (
    <Wrapper
      className={"identity-label " + className}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-haspopup={onClick ? "dialog" : undefined}
    >
      {compactField ? <span className="identity-label-caption">{children}</span> : children}
      {calculated ? (
        <input
          className="line-input"
          aria-label={label}
          value={value ?? ""}
          style={compactField
            ? { width: `${valueWidth}ch`, flex: "0 0 auto" }
            : undefined}
          readOnly
        />
      ) : (
        <LineField
          name={name}
          label={label}
          value={form[name]}
          onChange={onChange}
          numeric={numeric}
        />
      )}
    </Wrapper>
  );
}

export function IdentitySection({ form, derived, onChange, onOpenPointsBreakdown }) {
  return (
    <section className="identity" aria-label="Identidade do personagem">
      <div className="identity-row two">
        <IdentityLabel
          name="nome-personagem"
          label="Nome do personagem"
          form={form}
          onChange={onChange}
        >
          Nome do Personagem{" "}
        </IdentityLabel>
        <IdentityLabel name="grupo" label="Grupo" form={form} onChange={onChange}>
          Grupo{" "}
        </IdentityLabel>
      </div>

      <div className="identity-row two">
        <IdentityLabel
          name="identidade-civil"
          label="Identidade civil"
          form={form}
          onChange={onChange}
        >
          Identidade Civil{" "}
        </IdentityLabel>
        <div className="identity-checks">
          <span>Identidade</span>
          <label className="check-label">
            <CheckField
              name="identidade-secreta"
              label="Identidade secreta"
              value={form["identidade-secreta"]}
              onChange={onChange}
            />
            Secreta
          </label>
          <label className="check-label">
            <CheckField
              name="identidade-publica"
              label="Identidade pública"
              value={form["identidade-publica"]}
              onChange={onChange}
            />
            Pública
          </label>
        </div>
      </div>

      <div className="identity-row two">
        <IdentityLabel
          name="base-operacoes"
          label="Base de operações"
          form={form}
          onChange={onChange}
        >
          Base de Operações{" "}
        </IdentityLabel>
        <IdentityLabel
          name="primeira-aparicao"
          label="Primeira aparição"
          form={form}
          onChange={onChange}
        >
          Primeira Aparição{" "}
        </IdentityLabel>
      </div>

      <div className="identity-row five">
        <IdentityLabel
          name="nivel-poder"
          label="Nível de poder"
          form={form}
          calculated
          value={derived.powerLevel}
          className="power-level-field"
        >
          Nível de Poder{" "}
        </IdentityLabel>
        <IdentityLabel
          name="pontos-poder-p2"
          label="Pontos de poder gastos e total"
          form={form}
          calculated
          value={`${formatPoints(derived.powerPointsUsed)}/${formatPoints(derived.powerPointsTotal)}`}
          className="power-points-field"
          onClick={onOpenPointsBreakdown}
        >
          Pontos de poder{" "}
        </IdentityLabel>
        <IdentityLabel name="tamanho" label="Tamanho" form={form} onChange={onChange} numeric>
          Tamanho{" "}
        </IdentityLabel>
        <IdentityLabel name="altura" label="Altura" form={form} onChange={onChange} numeric>
          Altura{" "}
        </IdentityLabel>
        <IdentityLabel name="peso" label="Peso" form={form} onChange={onChange} numeric>
          Peso{" "}
        </IdentityLabel>
      </div>

      <div className="identity-row appearance-row">
        <IdentityLabel name="genero" label="Gênero" form={form} onChange={onChange}>
          Gênero{" "}
        </IdentityLabel>
        <IdentityLabel name="idade" label="Idade" form={form} onChange={onChange} numeric>
          Idade{" "}
        </IdentityLabel>
        <IdentityLabel name="olhos" label="Olhos" form={form} onChange={onChange}>
          Olhos{" "}
        </IdentityLabel>
        <IdentityLabel name="cabelo" label="Cabelo" form={form} onChange={onChange}>
          Cabelo{" "}
        </IdentityLabel>
      </div>
    </section>
  );
}
