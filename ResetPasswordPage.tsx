import { useState } from "react";
import { useApp } from "../context/AppContext";
import { LanguageSelector } from "../components/LanguageSelector";

export function ResetPasswordPage() {
  const { updatePassword, error, message, t } = useApp();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          if (password !== repeatPassword) return;
          await updatePassword(password);
        }}
      >
        <h1>{t.resetPassword}</h1>
        <LanguageSelector />

        {error && <div className="alert">{error}</div>}
        {message && <div className="notice">{message}</div>}

        <label>{t.newPassword}</label>
        <input
          type="password"
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <label>{t.repeatPassword}</label>
        <input
          type="password"
          minLength={6}
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
          required
        />

        <button type="submit">{t.save}</button>
      </form>
    </div>
  );
}
