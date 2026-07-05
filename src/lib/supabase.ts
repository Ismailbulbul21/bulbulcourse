import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in."
  );
}

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
