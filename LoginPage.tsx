import { useState } from "react";
import { useApp } from "../context/AppContext";
import { LanguageSelector } from "../components/LanguageSelector";

export function LoginPage() {
  const { login, sendPasswordReset, error, message, t } = useApp();
  const [email, setEmail] = useState("vida_paredes@hotmail.com");
  const [password, setPassword] = useState("");

  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          await login(email.trim(), password);
        }}
      >
        <h1>{t.appName}</h1>
        <LanguageSelector />

        {error && <div className="alert">{error}</div>}
        {message && <div className="notice">{message}</div>}

        <label>{t.email}</label>
        <input
          type="email"
          value={email}
          autoComplete="username"
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label>{t.password}</label>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit">{t.login}</button>
        <button
          type="button"
          className="secondary"
          onClick={() => sendPasswordReset(email.trim())}
        >
          {t.forgotPassword}
        </button>
      </form>
    </div>
  );
}
