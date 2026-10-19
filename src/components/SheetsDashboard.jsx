import React, { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

export function SheetsDashboard() {
  const [user, setUser] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/api/sheets");
      setUser(result.user);
      setSheets(result.sheets);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const signOut = () => window.location.assign("/api/logout");

  return (
    <main className="portal-page">
      <header className="portal-header">
        <a className="portal-brand" href="/" aria-label="Fichas de RPG, início">
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
        <a className="system-card system-card--vampiro" href="/sistemas/vampiro/nova" aria-label="Abrir ficha de Vampiro">
          <span className="system-card-title" role="heading" aria-level="2">Vampiro: A Máscara</span>
        </a>
        <a className="system-card system-card--mutantes" href="/sistemas/mutantes/nova" aria-label="Abrir ficha de Mutantes">
          <span className="system-card-title" role="heading" aria-level="2">Mutantes & Malfeitores</span>
        </a>
      </section>

      {error && <p className="portal-error" role="alert">{error}</p>}

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
                      {sheet.system === "vampiro" ? (
                        <svg viewBox="850 0 670 245" role="img" aria-label="Vampiro: A Máscara">
                          <image href="/vampiro/img/borda.png" width="2342" height="3444" />
                        </svg>
                      ) : (
                        <img src="/assets/mm-logo.png" alt="Mutantes & Malfeitores" />
                      )}
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
