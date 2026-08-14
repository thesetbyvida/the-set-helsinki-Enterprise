import { useState } from "react";
import { useApp } from "../context/AppContext";
import { LanguageSelector } from "../components/LanguageSelector";

export function SetPasswordPage() {
  const { updatePassword, error, message, language } = useApp();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [done, setDone] = useState(false);

  const words = language === "fi" ? {
    title: "Luo salasana",
    intro: "Luo henkilökohtainen salasana The Set Helsinki -tilillesi.",
    password: "Uusi salasana",
    repeat: "Toista salasana",
    save: "Tallenna salasana",
    mismatch: "Salasanat eivät täsmää.",
    short: "Salasanassa on oltava vähintään 8 merkkiä.",
    success: "Salasana tallennettu. Voit nyt jatkaa sovellukseen.",
    continue: "Jatka sovellukseen",
  } : language === "es" ? {
    title: "Crear contraseña",
    intro: "Crea tu contraseña personal para acceder a The Set Helsinki.",
    password: "Nueva contraseña",
    repeat: "Repetir contraseña",
    save: "Guardar contraseña",
    mismatch: "Las contraseñas no coinciden.",
    short: "La contraseña debe tener al menos 8 caracteres.",
    success: "Contraseña guardada. Ya puedes continuar a la aplicación.",
    continue: "Continuar a la aplicación",
  } : {
    title: "Create password",
    intro: "Create your personal password for The Set Helsinki.",
    password: "New password",
    repeat: "Repeat password",
    save: "Save password",
    mismatch: "Passwords do not match.",
    short: "Password must be at least 8 characters.",
    success: "Password saved. You can now continue to the application.",
    continue: "Continue to app",
  };

  if (done) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>{words.title}</h1>
          <div className="notice">{words.success}</div>
          <button type="button" onClick={() => window.location.assign("/")}>{words.continue}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setLocalError("");
          if (password.length < 8) { setLocalError(words.short); return; }
          if (password !== repeatPassword) { setLocalError(words.mismatch); return; }
          const ok = await updatePassword(password);
          if (ok) setDone(true);
        }}
      >
        <h1>{words.title}</h1>
        <p>{words.intro}</p>
        <LanguageSelector />
        {(localError || error) && <div className="alert">{localError || error}</div>}
        {message && <div className="notice">{message}</div>}
        <label>{words.password}</label>
        <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <label>{words.repeat}</label>
        <input type="password" minLength={8} value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} required />
        <button type="submit">{words.save}</button>
      </form>
    </div>
  );
}
