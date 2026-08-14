import { useEffect, useState } from "react";
import { LanguageSelector } from "../components/LanguageSelector";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";

export function SetPasswordPage() {
  const { language } = useApp();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [inviteUserId, setInviteUserId] = useState("");

  const words = language === "fi" ? {
    title: "Luo salasana", intro: "Luo henkilökohtainen salasana The Set Helsinki -tilillesi.", password: "Uusi salasana", repeat: "Toista salasana", save: "Tallenna salasana", mismatch: "Salasanat eivät täsmää.", short: "Salasanassa on oltava vähintään 8 merkkiä.", success: "Salasana tallennettu. Kirjaudu nyt uudella salasanallasi.", login: "Siirry kirjautumiseen", invalid: "Tämä kutsulinkki ei vastaa aktiivista käyttäjää. Avaa uusin kutsu yksityisessä selausikkunassa.", checking: "Tarkistetaan kutsua…"
  } : language === "es" ? {
    title: "Crear contraseña", intro: "Crea tu contraseña personal para acceder a The Set Helsinki.", password: "Nueva contraseña", repeat: "Repetir contraseña", save: "Guardar contraseña", mismatch: "Las contraseñas no coinciden.", short: "La contraseña debe tener al menos 8 caracteres.", success: "Contraseña guardada. Inicia sesión ahora con tu nueva contraseña.", login: "Ir al inicio de sesión", invalid: "Este enlace de invitación no corresponde al usuario activo. Abre la invitación más reciente en una ventana privada/incógnito.", checking: "Verificando invitación…"
  } : {
    title: "Create password", intro: "Create your personal password for The Set Helsinki.", password: "New password", repeat: "Repeat password", save: "Save password", mismatch: "Passwords do not match.", short: "Password must be at least 8 characters.", success: "Password saved. Sign in now with your new password.", login: "Go to sign in", invalid: "This invitation does not match the active user. Open the latest invitation in a private/incognito window.", checking: "Verifying invitation…"
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const expectedEmployeeId = query.get("employee") || "";

        // Explicitly adopt invitation credentials from the URL when present.
        // This prevents an already signed-in admin session from being used by mistake.
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
        } else {
          const tokenHash = query.get("token_hash");
          const type = query.get("type");
          if (tokenHash && type === "invite") {
            const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
            if (verifyError) throw verifyError;
          }
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw userError || new Error(words.invalid);
        if (!expectedEmployeeId) throw new Error(words.invalid);

        const { data: employee, error: employeeError } = await supabase
          .from("employees")
          .select("id,email,auth_user_id")
          .eq("id", expectedEmployeeId)
          .eq("auth_user_id", userData.user.id)
          .maybeSingle();
        if (employeeError) throw employeeError;
        if (!employee) throw new Error(words.invalid);
        if ((employee.email || "").toLowerCase() !== (userData.user.email || "").toLowerCase()) throw new Error(words.invalid);

        if (!cancelled) {
          setInviteUserId(userData.user.id);
          setReady(true);
          // Remove tokens from the address bar after the session is established.
          window.history.replaceState({}, document.title, `${window.location.pathname}?employee=${encodeURIComponent(expectedEmployeeId)}`);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || words.invalid);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!ready || !inviteUserId) { setError(words.invalid); return; }
    if (password.length < 8) { setError(words.short); return; }
    if (password !== repeatPassword) { setError(words.mismatch); return; }
    setSaving(true);
    try {
      const { data: current, error: currentError } = await supabase.auth.getUser();
      if (currentError || current.user?.id !== inviteUserId) throw new Error(words.invalid);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setDone(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  if (done) return <div className="auth-screen"><div className="auth-card"><h1>{words.title}</h1><div className="notice">{words.success}</div><button type="button" onClick={() => window.location.assign("/")}>{words.login}</button></div></div>;

  return <div className="auth-screen"><form className="auth-card" onSubmit={savePassword}>
    <h1>{words.title}</h1><p>{words.intro}</p><LanguageSelector />
    {!ready && !error && <div className="notice">{words.checking}</div>}
    {error && <div className="alert">{error}</div>}
    <label>{words.password}</label><input type="password" minLength={8} value={password} onChange={(e)=>setPassword(e.target.value)} required disabled={!ready || saving}/>
    <label>{words.repeat}</label><input type="password" minLength={8} value={repeatPassword} onChange={(e)=>setRepeatPassword(e.target.value)} required disabled={!ready || saving}/>
    <button type="submit" disabled={!ready || saving}>{saving ? "…" : words.save}</button>
  </form></div>;
}
