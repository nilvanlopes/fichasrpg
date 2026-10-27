import React, { useEffect, useState } from "react";
import "./portal.css";
import { apiRequest } from "../../shared/api/client";

export function SignupPage() {
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiRequest("/api/signup/config").then(config => setGoogleEnabled(config.googleEnabled)).catch(() => {});
  }, []);

  const signup = async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const passwordRepeat = String(data.get("passwordRepeat") || "");
    if (password !== passwordRepeat) return setMessage("As senhas não são iguais.");
    setBusy(true);
    setMessage("Criando sua conta…");
    try {
      const result = await apiRequest("/api/signup/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, passwordRepeat }),
      });
      setSuccess(true);
      setMessage(result.message);
    } catch (error) {
      setMessage(error.code === "invalid_signup" ? "Revise nome de usuário, e-mail e senha." : error.message);
    } finally {
      setBusy(false);
    }
  };

  const signupWithGoogle = async () => {
    setBusy(true);
    setMessage("Abrindo o Google…");
    try {
      const result = await apiRequest("/api/signup/google/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      window.location.assign(result.redirectTo);
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  return (
    <main className="signup-page">
      <a className="signup-home" href="/">← Voltar ao início</a>
      <section className="signup-card">
        <div className="signup-mark" aria-hidden="true">✦</div>
        <p className="portal-eyebrow">Fichas de RPG</p>
        <h1>{success ? "Confira seu e-mail" : "Crie sua conta"}</h1>
        {success ? (
          <div className="signup-message signup-message--success" role="status" aria-live="polite">
            <p>{message}</p>
            <p>Depois de confirmar o endereço, <a href="/fichas">entre para acessar suas fichas.</a></p>
          </div>
        ) : (
          <>
            <p className="signup-lede">Crie sua conta para guardar e organizar suas fichas de RPG.</p>
            <form className="signup-form" onSubmit={signup}>
              <label>
                <span>Nome de usuário</span>
                <input name="username" autoComplete="username" minLength="3" maxLength="64" pattern="[a-zA-Z0-9_.\-]+" title="Use letras, números, ponto, hífen ou sublinhado." required />
              </label>
              <label>
                <span>E-mail</span>
                <input name="email" type="email" autoComplete="email" maxLength="254" required />
              </label>
              <label>
                <span>Senha</span>
                <input name="password" type="password" autoComplete="new-password" minLength="10" maxLength="256" required />
                <small>Use pelo menos 10 caracteres.</small>
              </label>
              <label>
                <span>Confirme sua senha</span>
                <input name="passwordRepeat" type="password" autoComplete="new-password" minLength="10" maxLength="256" required />
              </label>
              <p className="signup-message" role="status" aria-live="polite">{message}</p>
              <button className="signup-submit" type="submit" disabled={busy}>
                {busy ? "Aguarde…" : "Criar conta"}
              </button>
            </form>
            {googleEnabled && <>
              <div className="signup-divider"><span>ou</span></div>
              <button className="signup-google" type="button" onClick={signupWithGoogle} disabled={busy}>
                Continuar com Google
              </button>
            </>}
          </>
        )}
        {!success && <p className="signup-login-link">Já tem conta? <a href="/fichas">Entrar</a></p>}
      </section>
      <p className="signup-invite-note">O cadastro dá acesso somente ao FichasRPG.</p>
    </main>
  );
}
