import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = "https://nkcivwjwmuphkqygazpj.supabase.co";
const anonKey = "sb_publishable_UW6BBKrhlIT5srKaJ3U72Q_XfEYBjJ9";

export const SUPABASE_ENABLED = true;

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
