import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Both values are public by design. Security is enforced by RLS + RPCs in supabase/schema.sql.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isConfigured = Boolean(url && anonKey);

// Browser-only client. Null when env vars are missing, so the app can show a setup
// notice instead of crashing (and `next build` works without credentials).
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Implicit flow lets a magic link requested on a laptop be opened on a phone.
        flowType: "implicit",
      },
    })
  : null;
