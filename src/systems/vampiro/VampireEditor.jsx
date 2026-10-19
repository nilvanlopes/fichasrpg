import React, { useEffect, useRef } from "react";
import legacyMarkup from "./legacy-markup.html?raw";
import "./vampire.css";
import { Toolbar } from "../../components/Toolbar";
import { useRpgSheet } from "../../useRpgSheet";

function stateOptions(root) {
  const track = root?.closest(".fome") ? [1, 4]
    : root?.closest(".humanidade") ? [1, 2, 4]
      : [1, 2, 3, 4];
  return track;
}

function serializeVampireForm(root) {
  const form = {};
  root.querySelectorAll("[id]").forEach(element => {
    if (element.matches("input[type=radio], input[type=checkbox]")) form[element.id] = element.checked;
    else if (element.matches("img.estado")) form[element.id] = element.alt;
    else if (element.matches("input, textarea, select")) form[element.id] = element.value;
  });
  form["vampire-theme"] = root.classList.contains("dark") ? "dark" : "light";
  return form;
}

function applyVampireForm(root, form) {
  if (!root) return;
  root.querySelectorAll("input, textarea, select").forEach(element => {
    if (element.matches("input[type=radio], input[type=checkbox]")) {
      element.checked = false;
      if (element.matches("input[type=radio]")) element.value = "0";
    } else element.value = "";
  });
  root.querySelectorAll("img.estado").forEach(element => {
    element.alt = "1";
    element.src = "/vampiro/img/trilhascheckbox/1.png";
  });
  for (const [id, value] of Object.entries(form || {})) {
    if (id === "vampire-theme") continue;
    const element = root.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!element) continue;
    if (element.matches("input[type=radio], input[type=checkbox]")) {
      element.checked = Boolean(value);
      if (element.matches("input[type=radio]")) element.value = value ? "1" : "0";
    } else if (element.matches("img.estado")) {
      const allowed = stateOptions(element.closest(".ponto"));
      const parsed = Number(value);
      const state = String(allowed.includes(parsed) ? parsed : 1);
      element.alt = state;
      element.src = `/vampiro/img/trilhascheckbox/${state}.png`;
    } else if (element.matches("input, textarea, select")) {
      element.value = value ?? "";
    }
  }
  const dark = form?.["vampire-theme"] === "dark" || form?.tema === "dark";
  root.classList.toggle("dark", dark);
}

function VampireForm({ form, ready, dirty, replaceForm, conflict }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!ready || dirty || !rootRef.current) return;
    applyVampireForm(rootRef.current, form);
  }, [form, ready, dirty]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready || conflict) return undefined;
    const changed = () => replaceForm(serializeVampireForm(root));
    const click = event => {
      const radio = event.target.closest('input[type="radio"]');
      if (radio && root.contains(radio)) {
        if (radio.value === "1") {
          radio.checked = false;
          radio.value = "0";
        } else {
          radio.checked = true;
          radio.value = "1";
        }
        changed();
        return;
      }
      const point = event.target.closest(".ponto");
      if (point && root.contains(point)) {
        const image = point.querySelector("img.estado");
        if (!image) return;
        const states = stateOptions(point);
        const current = states.indexOf(Number(image.alt));
        const next = states[(current + 1 + states.length) % states.length];
        image.alt = String(next);
        image.src = `/vampiro/img/trilhascheckbox/${next}.png`;
        changed();
      }
    };
    const input = event => {
      if (event.target.matches("input[type=text], textarea")) changed();
    };
    root.addEventListener("click", click);
    root.addEventListener("input", input);
    root.addEventListener("change", input);
    return () => {
      root.removeEventListener("click", click);
      root.removeEventListener("input", input);
      root.removeEventListener("change", input);
    };
  }, [ready, conflict, replaceForm]);

  return (
    <fieldset className="vampire-fields" disabled={conflict}>
      <div className={`vampire-root${form["vampire-theme"] === "dark" ? " dark" : ""}`} ref={rootRef}>
        <div className="vampire-top"><img src="/vampiro/img/borda.png" alt="" /></div>
        <div dangerouslySetInnerHTML={{ __html: legacyMarkup }} />
      </div>
    </fieldset>
  );
}

export function VampireEditor({ sheetId }) {
  const sheet = useRpgSheet(sheetId, "vampiro");
  const conflict = sheet.failure === "SHEET_CONFLICT";

  const toggleTheme = () => {
    const root = document.querySelector(".vampire-root");
    if (!root) return;
    root.classList.toggle("dark");
    sheet.replaceForm(serializeVampireForm(root));
  };

  const clearVampire = () => {
    if (!window.confirm("Limpar todos os campos desta ficha?")) return;
    const root = document.querySelector(".vampire-root");
    if (!root) return;
    root.querySelectorAll("input[type=text], textarea").forEach(element => { element.value = ""; });
    root.querySelectorAll("input[type=radio], input[type=checkbox]").forEach(element => {
      element.checked = false;
      if (element.matches("input[type=radio]")) element.value = "0";
    });
    root.querySelectorAll("img.estado").forEach(element => {
      element.alt = "1";
      element.src = "/vampiro/img/trilhascheckbox/1.png";
    });
    root.classList.remove("dark");
    sheet.replaceForm(serializeVampireForm(root));
  };

  return (
    <>
      <Toolbar
        onSave={sheet.save}
        onPrint={() => window.print()}
        onClear={clearVampire}
        onReload={sheet.reload}
        onLogout={sheet.logout}
        onExport={sheet.exportFile}
        onImport={sheet.importFile}
        importing={sheet.importing}
        onDelete={sheet.remove}
        deleting={sheet.deleting}
        sheetId={sheet.sheet?.id}
        sheetName={sheet.sheet?.name}
        system="vampiro"
        user={sheet.user}
        disabled={!sheet.ready || Boolean(sheet.legacy)}
        saving={sheet.saving}
        conflict={conflict}
      />
      {sheet.ready && <div className="vampire-toolbar-extra">
        <button type="button" onClick={toggleTheme} disabled={conflict || sheet.importing}>Alternar tema</button>
        <span role="status" aria-live="polite">{sheet.status}</span>
      </div>}
      {!sheet.ready ? (
        <section className="account-notice" aria-live="polite">
          <h1>{sheet.loading ? "Carregando sua ficha…" : "Não foi possível abrir sua ficha"}</h1>
          <p>{sheet.status}</p>
          {!sheet.loading && (["LOGIN_REQUIRED", "ACCESS_DENIED"].includes(sheet.failure)
            ? <a href="/outpost.goauthentik.io/start">Entrar com sua conta</a>
            : <button type="button" onClick={sheet.reload}>Tentar novamente</button>)}
        </section>
      ) : (
        <>
          {conflict && <section className="account-notice"><p>{sheet.status}</p><button type="button" onClick={sheet.reload}>Recarregar ficha</button></section>}
          <VampireForm form={sheet.form} ready={sheet.ready} dirty={sheet.dirty}
            replaceForm={sheet.replaceForm} conflict={conflict || sheet.importing} />
        </>
      )}
    </>
  );
}
