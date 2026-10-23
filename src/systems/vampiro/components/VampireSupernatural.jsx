import React from "react";
import { LineField } from "../../../shared/ui/FormField";
import { advantages, bloodFields, flaws, pointFields, trackFields } from "../data.js";
import { DotRating, StateTrack, VampireField, VampirePanel } from "./VampireFields";

export function VampireBlood({ form, onChange }) {
  return (
    <VampirePanel title="Sangue e humanidade" id="vampire-blood-title" className="vampire-blood">
      <div className="vampire-grid">
        <VampireField name="ressonancia" label="Ressonância" form={form} onChange={onChange} />
        <StateTrack fields={trackFields(21, 5)} label="Fome" kind="hunger" form={form} onChange={onChange} />
        <StateTrack fields={trackFields(26, 10)} label="Humanidade" kind="humanity" form={form} onChange={onChange} />
      </div>
    </VampirePanel>
  );
}

function VampirePotency({ form, onChange }) {
  return (
    <section className="vampire-potency" aria-labelledby="vampire-potency-title">
      <div className="vampire-blood-potency">
        <h2 id="vampire-potency-title">Potência de Sangue</h2>
        <DotRating fields={pointFields(336, 10)} label="Potência de Sangue" form={form} onChange={onChange} />
      </div>
      <div className="vampire-blood-effects">
        {bloodFields.map(([name, label]) => <VampireField key={name} name={name} label={label} form={form} onChange={onChange} />)}
      </div>
      <div className="vampire-experience">
        <VampireField name="et" label="Experiência Total" form={form} onChange={onChange} numeric />
        <VampireField name="eg" label="Experiência Gasta" form={form} onChange={onChange} numeric />
      </div>
    </section>
  );
}

function BackgroundList({ title, id, entries, form, onChange }) {
  return (
    <VampirePanel title={title} id={id} className="vampire-background-list">
      {entries.map(({ name, points }, index) => (
        <div className="vampire-background" key={name}>
          <LineField name={name} label={`${title}: descrição ${index + 1}`} value={form[name]} onChange={onChange} />
          <DotRating fields={points} label={`${title}: linha ${index + 1}`} form={form} onChange={onChange} />
        </div>
      ))}
    </VampirePanel>
  );
}

export function VampireBackgrounds(props) {
  return (
    <div className="vampire-grid vampire-backgrounds">
      <BackgroundList title="Vantagens" id="vampire-advantages-title" entries={advantages} {...props} />
      <BackgroundList title="Defeitos" id="vampire-flaws-title" entries={flaws} {...props} />
      <VampirePotency {...props} />
    </div>
  );
}
