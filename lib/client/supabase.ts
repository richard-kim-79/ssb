import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client, used only for Realtime progress updates.
 *
 * This is optional: when the public env vars are absent the app falls back to
 * polling (see useLiveRefresh). We never use this client for data reads/writes —
 * all data access goes through our own authenticated API routes. The anon key is
 * safe to expose (it's designed for browsers); Realtime authorization is handled
 * by Supabase (RLS / channel auth) on the project.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null | undefined;

export function isRealtimeConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Returns a singleton browser client, or null when Realtime is not configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  _client =
    SUPABASE_URL && SUPABASE_ANON_KEY
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false },
          realtime: { params: { eventsPerSecond: 5 } },
        })
      : null;
  return _client;
}
