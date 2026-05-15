import { createClient } from "@supabase/supabase-js";

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

  export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

  export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient("https://placeholder.supabase.co", "placeholder-key-000000000000000000000000000");
  