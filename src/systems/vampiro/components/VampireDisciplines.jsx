import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../../shared/api/client.js";
import { disciplines } from "../data.js";
import { DotRating, VampirePanel } from "./VampireFields";
import { VampirePowerCard } from "./VampirePowerCard";
import { canMimicPower, clearFormula, distillationMethods, formulaAlreadyKnown, formulaFields,
  isThinBloodAlchemy, normalizeName as normalize, readFormula, writeFormula } from "../thinBloodAlchemy.js";

const mimicOption = { id: "mimic-discipline", name: "Mimic Discipline", action: true };

function DisciplineBlock({ fields, index, form, onChange, onSelect, onInspect }) {
  const empty = fields.powers.every(key => !normalize(form[key]));
  const title = form[fields.name] || `Disciplina ${index + 1}`;
  if (empty) return (
    <section className="vampire-discipline vampire-discipline--empty" aria-label={`Disciplina ${index + 1}`}>
      <button type="button" className="vampire-discipline-empty-target" aria-label={`Escolher disciplina ${index + 1}`}
        aria-haspopup="dialog" onClick={() => onSelect(index, null)}>
        <span className="vampire-discipline-name"><span className="vampire-discipline-line vampire-discipline-title" data-field={fields.name}>{form[fields.name]}</span>
          <span className="vampire-dots" aria-hidden="true">{fields.points.map(key => <span className="vampire-dot" key={key}>
            <span className="check" data-field={key} data-checked={Boolean(form[key])} />
          </span>)}</span>
        </span>
        {fields.powers.map(key => <span key={key} className="vampire-discipline-line" data-field={key} />)}
      </button>
    </section>
  );
  return (
    <section className="vampire-discipline" aria-label={`Disciplina ${index + 1}`}>
      <div className="vampire-discipline-name">
        <button type="button" className="vampire-discipline-line vampire-discipline-title" data-field={fields.name}
          aria-label={`Selecionar disciplina ${index + 1}${form[fields.name] ? `: ${title}` : ""}`}
          aria-haspopup="dialog" onClick={() => onSelect(index, null)}>{form[fields.name]}</button>
        <DotRating fields={fields.points} label={title} form={form} onChange={onChange} />
      </div>
      {fields.powers.map((key, row) => (
        <button type="button" className="vampire-discipline-line" key={key} data-field={key}
          aria-label={`${title}: poder ${row + 1}${form[key] ? `, ${form[key]}` : ""}`}
          aria-haspopup="dialog" onClick={event => normalize(form[key])
            ? onInspect(index, row, event) : onSelect(index, row)}>{form[key]}</button>
      ))}
    </section>
  );
}

export function VampireDisciplines({ form, onChange, disabled = false }) {
  const dialogRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const requestVersion = useRef(0);
  const inspectionVersion = useRef(0);
  useEffect(() => () => { requestVersion.current += 1; }, []);
  useEffect(() => {
    if (disabled) { dialogRef.current?.close(); setInspection(null); }
  }, [disabled]);

  async function loadCatalog() {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/systems/vampiro/disciplines");
      if (version === requestVersion.current) setCatalog(data.disciplines);
    } catch (failure) {
      if (version === requestVersion.current) setError(failure.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  function open(index, row) {
    if (disabled) return;
    setInspection(null);
    const current = catalog?.find(item => normalize(item.name) === normalize(form[disciplines[index].name]));
    setSelection({ index, row, disciplineId: row !== null ? current?.id || "current" : null });
    setSearch("");
    dialogRef.current.showModal();
    if (!catalog && !loading) loadCatalog();
  }

  function inspect(index, row, event) {
    if (disabled) return;
    const trigger = event.currentTarget;
    const bounds = trigger.getBoundingClientRect();
    setInspection({ id: ++inspectionVersion.current, index, row, trigger,
      x: event.detail === 0 ? bounds.left : event.clientX,
      y: event.detail === 0 ? bounds.bottom : event.clientY });
    if (!catalog && !loading) loadCatalog();
  }

  const closeInspection = useCallback((restoreFocus = false) => {
    setInspection(current => current === inspection ? null : current);
    if (restoreFocus && inspection?.trigger.isConnected) inspection.trigger.focus({ preventScroll: true });
  }, [inspection]);
  const inspectedFields = inspection && disciplines[inspection.index];
  const inspectedKey = inspectedFields?.powers[inspection?.row];
  const inspectedFormula = readFormula(form, inspectedKey);
  const inspectingAlchemy = isThinBloodAlchemy(form[inspectedFields?.name]);
  const copied = inspectingAlchemy && !!inspectedFormula.discipline && !!inspectedFormula.power;
  const inspectedDiscipline = catalog?.find(item => copied ? item.id === inspectedFormula.discipline
    : normalize(item.name) === normalize(form[inspectedFields?.name]));
  const inspectedPower = inspectedDiscipline?.powers.find(item => copied ? item.id === inspectedFormula.power
    : normalize(item.name) === normalize(form[inspectedKey]));

  const fields = selection && disciplines[selection.index];
  const selected = catalog?.find(item => selection?.disciplineId === "current"
    ? normalize(item.name) === normalize(form[fields?.name]) : item.id === selection?.disciplineId);
  const alchemy = isThinBloodAlchemy(selected);
  const mimicSource = selection?.mimic && catalog?.find(item => item.id === selection.sourceId);
  const powerDiscipline = selection?.mimic ? mimicSource : selected;
  const currentPower = fields && selection.row !== null ? form[fields.powers[selection.row]] : "";
  const targetKey = fields && (selection.row !== null ? fields.powers[selection.row] : fields.powers.find(key => !normalize(form[key])));
  const available = selection?.mimic ? (mimicSource
    ? mimicSource.powers.filter(power => canMimicPower(mimicSource, power))
    : (catalog || []).filter(discipline => discipline.powers.some(power => canMimicPower(discipline, power))))
    : selected ? [...(alchemy ? [mimicOption] : []), ...selected.powers] : catalog || [];
  const items = available.filter(item =>
    normalize(`${item.name} ${item.level || ""}`).includes(normalize(search)));
  const pending = selection?.pending;
  const backLabel = pending ? "Voltar aos poderes" : selection?.mimic
    ? mimicSource ? "Voltar às disciplinas" : "Voltar à alquimia"
    : selected ? "Voltar às disciplinas" : "";
  useEffect(() => {
    if (!pending) return;
    const dialog = dialogRef.current;
    (dialog.querySelector(".vampire-formula-methods input:checked:not(:disabled)")
      || dialog.querySelector(".vampire-formula-methods input:not(:disabled)"))?.focus();
  }, [pending]);
  const methodCandidate = pending && { name: pending.power.name, method: selection.method || "",
    discipline: pending.copied ? pending.source.id : "", power: pending.copied ? pending.power.id : "" };
  const validMethod = distillationMethods.some(method => method.id === selection?.method);
  const duplicateMethod = !!selection?.method && methodCandidate && formulaAlreadyKnown(form, fields, methodCandidate, targetKey);

  function goBack() {
    if (pending) setSelection({ ...selection, pending: null, methodOnly: false });
    else if (selection.mimic) setSelection({ ...selection, ...(mimicSource ? { sourceId: null } : { mimic: false }) });
    else setSelection({ ...selection, disciplineId: null });
    setSearch("");
  }

  function removePower(key) {
    if (disabled || !key) return;
    onChange(key, "");
    clearFormula(key, onChange);
  }

  function chooseDiscipline(item) {
    if (disabled) return;
    if (selection.mimic) {
      if (!item.powers.some(power => canMimicPower(item, power))) return;
      setSelection({ ...selection, sourceId: item.id });
      setSearch("");
      return;
    }
    if (normalize(form[fields.name]) !== normalize(item.name)) {
      onChange(fields.name, item.name);
      fields.powers.forEach(removePower);
      fields.points.forEach(key => onChange(key, false));
    }
    setSelection({ ...selection, disciplineId: item.id });
    setSearch("");
  }

  function choosePower(item) {
    if (disabled) return;
    if (item.action) {
      setSelection({ ...selection, mimic: true, sourceId: null });
      setSearch("");
      return;
    }
    if (!targetKey || (selection.mimic && !canMimicPower(mimicSource, item))) return;
    if (alchemy) {
      setSelection({ ...selection, pending: { power: item, source: powerDiscipline, copied: !!selection.mimic }, method: "" });
      return;
    }
    clearFormula(targetKey, onChange);
    onChange(targetKey, item.name);
    dialogRef.current.close();
  }

  function saveFormula() {
    if (disabled || !targetKey || !methodCandidate || duplicateMethod) return;
    if (selection.methodOnly) {
      if (!distillationMethods.some(method => method.id === methodCandidate.method)) return;
      onChange(formulaFields(targetKey).method, methodCandidate.method);
    } else {
      if (pending.copied && !canMimicPower(pending.source, pending.power)) return;
      if (!writeFormula(targetKey, methodCandidate, onChange)) return;
    }
    dialogRef.current.close();
  }

  function editMethod() {
    if (disabled || !inspection) return;
    setSelection({ index: inspection.index, row: inspection.row, disciplineId: "current", methodOnly: true,
      method: inspectedFormula.method,
      pending: { power: inspectedPower || { id: inspectedFormula.power, name: form[inspectedKey] },
        source: inspectedDiscipline || { id: inspectedFormula.discipline }, copied } });
    setInspection(null);
    dialogRef.current.showModal();
  }

  return (
    <VampirePanel title="Disciplinas" id="vampire-disciplines-title" className="vampire-disciplines">
      <div className="vampire-grid">
        {disciplines.map((fields, index) => <DisciplineBlock key={fields.name} fields={fields} index={index}
          form={form} onChange={onChange} onSelect={open} onInspect={inspect} />)}
      </div>
      {inspection && <VampirePowerCard key={inspection.id} anchor={inspection} name={form[inspectedFields.powers[inspection.row]]}
        discipline={form[inspectedFields.name]} power={inspectedPower} loading={loading} error={error}
        alchemy={inspectingAlchemy ? { copied, source: inspectedDiscipline?.name || inspectedFormula.discipline,
          method: distillationMethods.find(method => method.id === inspectedFormula.method)?.name } : null}
        onMethod={inspectingAlchemy ? editMethod : undefined}
        onRetry={loadCatalog} onClose={closeInspection} onReplace={() => open(inspection.index, inspection.row)}
        onRemove={() => {
          if (disabled) return;
          removePower(inspectedFields.powers[inspection.row]);
          closeInspection();
        }} />}
      <dialog ref={dialogRef} className="vampire-discipline-dialog" aria-labelledby="vampire-discipline-dialog-title"
        onClose={() => setSelection(null)}>
        <header>
          {backLabel && <button type="button" className="vampire-dialog-icon" aria-label={backLabel} title={backLabel} onClick={goBack}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 5-7 7 7 7M5 12h14" />
            </svg>
          </button>}
          <h2 id="vampire-discipline-dialog-title">{pending ? "Método de destilação" : selection?.mimic
            ? mimicSource ? `Mimic Discipline — ${mimicSource.name}` : "Mimic Discipline"
            : selected ? `Poderes de ${selected.name}` : "Selecionar disciplina"}</h2>
          <button type="button" className="vampire-dialog-icon" aria-label="Fechar seleção de disciplinas" onClick={() => dialogRef.current.close()}>×</button>
        </header>
        {selection && <>
          {pending ? <>
            <p><strong>{pending.power.name}</strong>{pending.copied ? ` · ${pending.source.name || pending.source.id}` : ""}</p>
            <p>Selecione o método em que esta fórmula foi aprendida.</p>
            <fieldset className="vampire-formula-methods">
              <legend>Método de destilação</legend>
              {distillationMethods.map(method => {
                const known = formulaAlreadyKnown(form, fields, { ...methodCandidate, method: method.id }, targetKey);
                return <label key={method.id}>
                  <input type="radio" name="formula-distillation-method" value={method.id} checked={selection.method === method.id}
                    disabled={disabled || known} onChange={() => setSelection({ ...selection, method: method.id })} />
                  <span>{method.name}{known ? " · Já aprendido neste método" : ""}</span>
                </label>;
              })}
            </fieldset>
            {duplicateMethod && <p role="alert">Esta fórmula já foi aprendida neste método.</p>}
          </> : <>
          {selection.mimic ? <p>Selecione {mimicSource ? "um poder de nível 1 a 4" : "a disciplina de origem"}. A fórmula exige um nível de Alquimia a mais que o poder copiado.</p>
            : selected ? <p>Escolha um poder para {selection.row !== null ? `a linha ${selection.row + 1}` : "a primeira linha disponível"}.</p>
            : fields.powers.some(key => normalize(form[key])) && <p>Ao trocar a disciplina, os poderes e os pontos deste bloco serão limpos.</p>}
          {selected && selection.row === null && fields.powers.every(key => normalize(form[key]))
            && <p role="status">As cinco linhas estão ocupadas. Feche esta janela e clique na linha que deseja alterar.</p>}
          <label className="vampire-discipline-search">{powerDiscipline ? "Buscar poder" : "Buscar disciplina"}
            <input type="search" autoFocus value={search} onChange={event => setSearch(event.target.value)} />
          </label>
          {loading && <p role="status">Carregando disciplinas…</p>}
          {error && <div role="alert"><p>{error}</p><button type="button" onClick={loadCatalog}>Tentar novamente</button></div>}
          {!loading && !error && catalog?.length === 0 && <p role="status">O catálogo de disciplinas ainda não foi cadastrado.</p>}
          {!loading && !error && !!catalog?.length && items.length === 0 && <p role="status">{powerDiscipline && !powerDiscipline.powers.length
            ? "Nenhum poder cadastrado para esta disciplina." : "Nenhum resultado para esta busca."}</p>}
          <ul className="vampire-discipline-options">
            {items.map(item => {
              const alreadySelected = !item.action && powerDiscipline && (alchemy
                ? distillationMethods.every(method => formulaAlreadyKnown(form, fields, { name: item.name, method: method.id,
                  discipline: selection.mimic ? mimicSource.id : "", power: selection.mimic ? item.id : "" }, targetKey))
                : fields.powers.some(key => key !== targetKey && normalize(form[key]) === normalize(item.name)));
              const full = selected && selection.row === null && fields.powers.every(key => normalize(form[key]));
              return <li key={item.id}>
                <button type="button" disabled={disabled || alreadySelected || full}
                  onClick={() => powerDiscipline ? choosePower(item) : chooseDiscipline(item)}>
                  <span>{item.name}</span>
                  {powerDiscipline && !item.action && <small>Nível {item.level}{selection.mimic ? ` · Fórmula de nível ${item.level + 1}` : ""}{alreadySelected ? " · Já selecionado" : ""}</small>}
                </button>
              </li>;
            })}
          </ul>
          </>}
          {(pending || currentPower) && <footer>
            {pending && <button type="button" disabled={disabled || !validMethod || duplicateMethod} onClick={saveFormula}>Salvar fórmula</button>}
            {currentPower && !pending && <button type="button" onClick={() => {
              if (disabled) return;
              removePower(fields.powers[selection.row]);
              dialogRef.current.close();
            }}>Remover poder desta linha</button>}
          </footer>}
        </>}
      </dialog>
    </VampirePanel>
  );
}
