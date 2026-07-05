import { createClient } from "@supabase/supabase-js";

// The Supabase URL and anon key are PUBLIC values by design — they ship in
// the browser bundle either way, and Row Level Security protects the data.
// Baked-in fallbacks keep the deployed site working even when the hosting
// platform has no VITE_* env vars configured; env vars override when set.
const FALLBACK_URL = "https://uootbtclscecwaumcelj.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvb3RidGNsc2NlY3dhdW1jZWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxOTgxMTYsImV4cCI6MjA5ODc3NDExNn0.RtXCDEor2GcVMG0PASHCVTclLmYHKONI7I1We3gibC4";

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

export const supabase = createClient(url, anonKey);

/** Default timeout for database reads (spec: 15s, no stacked retries). */
export const QUERY_TIMEOUT_MS = 15_000;

export function queryTimeoutSignal(): AbortSignal {
  return AbortSignal.timeout(QUERY_TIMEOUT_MS);
}

/** Convert Supabase/fetch errors into a clear, user-readable Error. */
export function toError(error: unknown): Error {
  const msg = (error as { message?: string })?.message ?? "Request failed";
  if (/abort|timeout|signal/i.test(msg)) {
    return new Error(
      "The request timed out. Please check your internet connection and try again."
    );
  }
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(msg)) {
    return new Error("Network error. Please check your internet connection.");
  }
  return new Error(msg);
}
