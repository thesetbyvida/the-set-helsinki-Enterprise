import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { appUrl, isSupabaseConfigured, supabase } from "../lib/supabase";
import { dictionary } from "../lib/i18n";
import type { Language, Profile } from "../types/app";

interface AppContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string;
  message: string;
  language: Language;
  t: Record<string, string>;
  isSupabaseConfigured: boolean;
  setLanguage: (language: Language) => void;
  setError: (message: string) => void;
  setMessage: (message: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [language, setLanguageState] = useState<Language>(
    (localStorage.getItem("the_set_language") as Language) || "es"
  );

  const t = dictionary[language];

  async function loadProfile(activeSession = session) {
    if (!supabase || !activeSession?.user) {
      setProfile(null);
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,is_active,created_at")
      .eq("id", activeSession.user.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setProfile(null);
      return;
    }

    setProfile((data as Profile | null) || null);
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) await loadProfile(nextSession);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  function setLanguage(nextLanguage: Language) {
    localStorage.setItem("the_set_language", nextLanguage);
    setLanguageState(nextLanguage);
  }

  async function login(email: string, password: string) {
    if (!supabase) return;
    setError("");
    setMessage("");

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      return;
    }

    setSession(data.session);
    await loadProfile(data.session);
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  async function sendPasswordReset(email: string) {
    if (!supabase) return;
    setError("");
    setMessage("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });

    if (resetError) setError(resetError.message);
    else setMessage(t.resetSent);
  }

  async function updatePassword(password: string) {
    if (!supabase) return;
    setError("");
    setMessage("");

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else setMessage(t.passwordUpdated);
  }

  const value = useMemo<AppContextValue>(
    () => ({
      session,
      profile,
      loading,
      error,
      message,
      language,
      t,
      isSupabaseConfigured,
      setLanguage,
      setError,
      setMessage,
      login,
      logout,
      sendPasswordReset,
      updatePassword,
      reloadProfile: () => loadProfile(),
    }),
    [session, profile, loading, error, message, language]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
