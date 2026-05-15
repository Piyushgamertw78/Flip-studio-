import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── How to enable cloud sync ────────────────────────────────────────────────
// 1. Create a free project at https://supabase.com
// 2. Copy your Project URL and "anon / public" API key (starts with "eyJ")
// 3. Replace the values in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
//    OR set them via environment variables / .env file
// Without valid credentials the app works fully offline (all data on-device).
// ─────────────────────────────────────────────────────────────────────────────

const url     = import.meta.env.VITE_SUPABASE_URL     ?? "https://nkcivwjwmuphkqygazpj.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_UW6BBKrhlIT5srKaJ3U72Q_XfEYBjJ9";

// Valid Supabase anon keys are JWTs — they always start with "eyJ" and have 3 parts.
// The placeholder key above is NOT a valid JWT, so SUPABASE_ENABLED will be false
// and the app will run in local-only offline mode until real credentials are provided.
const isValidSupabaseKey = (k: string) =>
  typeof k === "string" && k.startsWith("eyJ") && k.split(".").length === 3;

export const SUPABASE_ENABLED = isValidSupabaseKey(anonKey);

// When credentials are invalid we still export a SupabaseClient instance so
// imports never break — but it points at a non-existent host so it can never
// succeed.  Auth code always checks SUPABASE_ENABLED before calling it.
export const supabase: SupabaseClient = createClient(
  SUPABASE_ENABLED ? url : "https://offline.invalid",
  SUPABASE_ENABLED
    ? anonKey
    : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJvZmZsaW5lIn0.aaaa",
  { auth: { autoRefreshToken: SUPABASE_ENABLED, persistSession: SUPABASE_ENABLED, detectSessionInUrl: false } }
);
