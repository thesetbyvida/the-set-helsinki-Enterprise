import { createClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
) as string | undefined;

export const isSupabaseConfigured =
  Boolean(configuredUrl) &&
  Boolean(configuredKey) &&
  !String(configuredKey).includes("PEGA_AQUI");

// Keep a real SupabaseClient instance at all times so consumers do not need
// nullable checks. The application still uses isSupabaseConfigured to decide
// whether Supabase-backed features are available.
const supabaseUrl = configuredUrl || "https://placeholder.supabase.co";
const supabaseKey = configuredKey || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const appUrl = (
  (import.meta.env.VITE_APP_URL as string | undefined) ||
  window.location.origin
).replace(/\/$/, "");
