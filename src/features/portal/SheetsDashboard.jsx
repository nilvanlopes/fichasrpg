import React, { useCallback, useEffect, useState } from "react";
import "./portal.css";
import { apiRequest } from "../../shared/api/client";
import { systems } from "../../systems/registry.js";
import { SystemLogo } from "./SystemLogo";

export function SheetsDashboard() {
  const [user, setUser] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest("/api/sheets");
      setUser(result.user);
      setSheets(result.sheets);
    } catch (failure) {
      setError(failure);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const signOut = () => window.location.assign("/api/logout");

  if (!user) {
    const redirecting = error?.code === "LOGIN_REQUIRED";
    return (
      <main className="account-notice">
        {loading || redirecting ? (
          <p role="status">{redirecting ? "Abrindo o login…" : "Verificando seu acesso…"}</p>
        ) : (
          <>
            <h1>Não foi possível abrir suas fichas</h1>
            <p role="alert">{error?.message}</p>
            <button type="button" onClick={load}>Tentar novamente</button>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="portal-page">
      <header className="portal-header">
        <a className="portal-brand" href="/fichas" aria-label="Fichas de RPG, início">
          <span className="portal-brand-name" aria-label="RPG">
            <span className="portal-brand-word portal-brand-word--vampiro" aria-hidden="true">RPG</span>
            <span className="portal-brand-word portal-brand-word--mutantes" aria-hidden="true">RPG</span>
          </span>
        </a>
        <div className="portal-user">
          {user && <span>Olá, <strong>{user.name || user.username}</strong></span>}
          {user && <button className="portal-quiet-button" type="button" onClick={signOut}>Sair</button>}
        </div>
      </header>

      <section className="system-grid" aria-label="Abrir uma ficha em branco">
        {Object.values(systems).map(system => (
          <a key={system.id} className={`system-card system-card--${system.id}`} href={`/sistemas/${system.id}/nova`}
            style={{ backgroundImage: `url("${system.cover}")` }} aria-label={`Abrir ficha de ${system.shortLabel}`}>
            <span className="system-card-title" role="heading" aria-level="2">{system.label}</span>
          </a>
        ))}
      </section>

      {error && <p className="portal-error" role="alert">{error.message}</p>}

      <section className="saved-sheets" aria-labelledby="saved-sheets-title">
        <div className="saved-sheets-heading">
          <h2 id="saved-sheets-title">Fichas recentes</h2>
        </div>
        {loading ? <p className="portal-muted" aria-live="polite">Carregando suas fichas…</p> :
          sheets.length === 0 ? (
            <div className="empty-sheets">
              <span aria-hidden="true">✧</span>
              <p>Você ainda não criou nenhuma ficha.</p>
            </div>
          ) : (
            <div className="sheet-list">
              {sheets.map(sheet => (
                <article className="sheet-card" key={sheet.id}>
                  <a href={`/sistemas/${sheet.system}/${sheet.id}`} className="sheet-card-link">
                    <span className={`sheet-system-icon sheet-system-icon--${sheet.system}`}>
                      <SystemLogo system={sheet.system} />
                    </span>
                    <span className="sheet-card-copy">
                      <strong>{sheet.name}</strong>
                    </span>
                    <span className="sheet-card-arrow" aria-hidden="true">↗</span>
                  </a>
                </article>
              ))}
            </div>
          )}
      </section>
      <footer className="portal-footer">Fichas RPG - nilvanlopes</footer>
    </main>
  );
}
