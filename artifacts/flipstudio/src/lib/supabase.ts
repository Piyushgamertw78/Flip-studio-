// Supabase client — safe init that works even without env vars (offline mode)
  import { createClient, type SupabaseClient } from "@supabase/supabase-js";

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  export const SUPABASE_ENABLED = !!(
    url && url.startsWith("https://") &&
    anonKey && anonKey.length > 20
  );

  export const supabase: SupabaseClient = SUPABASE_ENABLED
    ? createClient(url!, anonKey!, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : (null as unknown as SupabaseClient);
  