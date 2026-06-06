"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase, isRealtimeConfigured } from "@/lib/client/supabase";

interface LiveRefreshOptions {
  /** Only run while there is something in progress (e.g. grading/re-grading). */
  active: boolean;
  /** Called whenever fresh data should be pulled from our API. */
  refresh: () => Promise<unknown> | unknown;
  /** Postgres table to watch for changes, e.g. "essay_submissions". */
  table: string;
  /** Realtime row filter using DB column names, e.g. "id=eq.<uuid>". */
  filter?: string;
  /** Poll interval (ms) used when Realtime is not configured. */
  pollMs?: number;
  /** Safety re-poll interval (ms) used alongside Realtime to catch missed events. */
  safetyMs?: number;
}

/**
 * Keep a view in sync while work is in progress.
 *
 * When Supabase Realtime is configured (NEXT_PUBLIC_SUPABASE_URL + anon key) we
 * subscribe to Postgres changes on the given row(s) and call `refresh()` on each
 * event, plus a slow safety re-poll. Otherwise we fall back to plain interval
 * polling — so the page behaves identically with or without Realtime.
 */
export function useLiveRefresh({
  active,
  refresh,
  table,
  filter,
  pollMs = 2000,
  safetyMs = 15000,
}: LiveRefreshOptions) {
  // Keep the latest refresh fn without re-subscribing on every render.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!active) return;

    const run = () => {
      Promise.resolve(refreshRef.current()).catch(() => {});
    };

    const supabase = isRealtimeConfigured() ? getBrowserSupabase() : null;

    // Fallback: interval polling (existing behaviour).
    if (!supabase) {
      const t = setInterval(run, pollMs);
      return () => clearInterval(t);
    }

    // Realtime: subscribe to row changes + a slow safety re-poll.
    const channel = supabase
      .channel(`live:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        filter
          ? { event: "*", schema: "public", table, filter }
          : { event: "*", schema: "public", table },
        run,
      )
      .subscribe();

    const safety = setInterval(run, safetyMs);

    return () => {
      clearInterval(safety);
      supabase.removeChannel(channel);
    };
  }, [active, table, filter, pollMs, safetyMs]);
}
