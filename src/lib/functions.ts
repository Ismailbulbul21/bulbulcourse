import { supabase } from "./supabase";

export interface FnEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

/**
 * Invoke a Supabase Edge Function and unwrap the {success, data, error}
 * envelope. On non-2xx responses (FunctionsHttpError) the real error message
 * is read from the response body via error.context — otherwise the user only
 * sees "Edge Function returned a non-2xx status code".
 */
export async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<FnEnvelope<T>>(name, {
    body: body as Record<string, unknown>,
  });

  if (error) {
    let message = "Request failed. Please try again.";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const parsed = await context.json();
        message =
          parsed?.error?.message ?? parsed?.error ?? parsed?.message ?? message;
      } catch {
        if (error instanceof Error && error.message) message = error.message;
      }
    } else if (error instanceof Error && error.message) {
      message = error.message;
    }
    throw new Error(message);
  }

  if (!data) throw new Error("No response from server.");
  if (!data.success) {
    throw new Error(data.error?.message ?? "Request failed.");
  }
  return data.data as T;
}
