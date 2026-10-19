import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";

const callbackMessages = {
  google_state_expired: "O link do Google expirou. Comece novamente pelo convite.",
  google_email_not_verified: "O Google não confirmou este endereço de e-mail.",
  google_signup_failed: "Não foi possível concluir o cadastro pelo Google. Tente novamente.",
};

export function SignupPage() {
  const itoken = new URLSearchParams(window.location.search).get("itoken") || "";
  const callbackError = new URLSearchParams(window.location.search).get("error") || "";
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(callbackMessages[callbackError] || "");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiRequest("/api/signup/config").then(config => setGoogleEnabled(config.googleEnabled)).catch(() => {});
  }, []);

  const signup = async event => {
    event.preventDefault();
    if (!itoken) return setMessage("Este link não contém um convite válido.");
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
        body: JSON.stringify({ itoken, username, email, password, passwordRepeat }),
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
    if (!itoken) return setMessage("Este link não contém um convite válido.");
    setBusy(true);
    setMessage("Abrindo o Google…");
    try {
      const result = await apiRequest("/api/signup/google/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itoken }),
      });
      window.location.assign(result.redirectTo);
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  return (
    <main className="signup-page">
      <a className="signup-home" href="/">← Voltar às fichas</a>
      <section className="signup-card">
        <div className="signup-mark" aria-hidden="true">✦</div>
        <p className="portal-eyebrow">Fichas de RPG</p>
        <h1>{success ? "Confira seu e-mail" : "Crie sua conta"}</h1>
        {!itoken ? (
          <div className="signup-message signup-message--error" role="alert">
            {callbackMessages[callbackError] || "Para se cadastrar, abra um convite válido enviado pela administração."}
          </div>
        ) : success ? (
          <div className="signup-message signup-message--success" role="status" aria-live="polite">
            <p>{message}</p>
            <p>Depois de confirmar o endereço, <a href="/">entre para acessar suas fichas.</a></p>
          </div>
        ) : (
          <>
            <p className="signup-lede">Use a mesma conta para guardar personagens de vários sistemas.</p>
            <form className="signup-form" onSubmit={signup}>
              <label>
                <span>Nome de usuário</span>
                <input name="username" autoComplete="username" minLength="3" maxLength="64" required />
              </label>
              <label>
                <span>E-mail</span>
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                <span>Senha</span>
                <input name="password" type="password" autoComplete="new-password" minLength="10" required />
                <small>Use pelo menos 10 caracteres.</small>
              </label>
              <label>
                <span>Confirme sua senha</span>
                <input name="passwordRepeat" type="password" autoComplete="new-password" minLength="10" required />
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
        {!success && <p className="signup-login-link">Já tem conta? <a href="/">Entrar</a></p>}
      </section>
      <p className="signup-invite-note">O cadastro está disponível por convite.</p>
    </main>
  );
}
