import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";

export type SettingKey =
  | "whatsapp_number"
  | "services_enabled"
  | "booking_enabled"
  | "meeting_url";

export type Settings = Record<string, string>;

export const SettingsService = {
  /**
   * Every setting the caller may see. RLS returns the public ones (WhatsApp
   * number, feature switches) to everybody and everything to admins.
   */
  async all(): Promise<Settings> {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return Object.fromEntries(
      (data ?? []).map((row) => [row.key as string, row.value as string])
    );
  },

  /** Admin only — enforced by RLS. */
  async set(key: SettingKey, value: string): Promise<void> {
    const { error } = await supabase
      .from("app_settings")
      .update({ value })
      .eq("key", key);
    if (error) throw toError(error);
  },
};

export function isOn(settings: Settings | undefined, key: SettingKey): boolean {
  return settings?.[key] === "true";
}
