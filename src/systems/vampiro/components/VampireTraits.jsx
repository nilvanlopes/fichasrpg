import React from "react";
import { LineField } from "../../../shared/ui/FormField";
import { attributes, identityFields, pointFields, skills, trackFields } from "../data.js";
import { DotRating, StateTrack, VampireField, VampirePanel } from "./VampireFields";

export function VampireIdentity({ form, onChange }) {
  return (
    <VampirePanel title="Identidade" id="vampire-identity-title" className="vampire-identity">
      <div className="vampire-grid">
        {identityFields.map(([name, label]) => (
          <VampireField key={name} name={name} label={label} form={form} onChange={onChange} numeric={name === "geracao"} />
        ))}
      </div>
    </VampirePanel>
  );
}

export function VampireAttributes({ form, onChange }) {
  return (
    <VampirePanel title="Atributos" id="vampire-attributes-title" className="vampire-attributes">
      <div className="vampire-grid">
        {attributes.map(group => (
          <section key={group.label} aria-label={`Atributos ${group.label.toLowerCase()}`}>
            <h3>{group.label}</h3>
            {group.traits.map(([label, start]) => (
              <div className="vampire-trait" key={label}>
                <span>{label}</span>
                <DotRating fields={pointFields(start)} label={label} form={form} onChange={onChange} />
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="vampire-grid vampire-grid--two vampire-damage">
        <StateTrack fields={trackFields(1, 10)} label="Vitalidade" form={form} onChange={onChange} />
        <StateTrack fields={trackFields(11, 10)} label="Força de Vontade" form={form} onChange={onChange} />
      </div>
    </VampirePanel>
  );
}

export function VampireSkills({ form, onChange }) {
  return (
    <VampirePanel title="Habilidades" id="vampire-skills-title" className="vampire-skills">
      <div className="vampire-grid">
        {skills.map(group => (
          <section key={group.label} aria-label={`Habilidades ${group.label.toLowerCase()}`}>
            <h3>{group.label}</h3>
            {group.traits.map(([label, name, start]) => (
              <div className="vampire-trait vampire-skill" key={name}>
                <span>{label}</span>
                <LineField name={name} label={`${label}: especialidade`} value={form[name]} onChange={onChange} />
                <DotRating fields={pointFields(start)} label={label} form={form} onChange={onChange} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </VampirePanel>
  );
}
