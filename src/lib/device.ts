import { supabase } from "./supabase";

const DEVICE_KEY = "bb_device_id";

/** Stable random id for this browser/device, persisted in localStorage. */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/**
 * Claim the single playback slot for this account. The most recent device
 * to open the app becomes the active one — get-video-url only signs
 * playback URLs for the active device, so shared accounts keep kicking
 * each other out.
 */
export async function claimDevice(userId: string): Promise<void> {
  try {
    await supabase.from("user_devices").upsert(
      {
        user_id: userId,
        device_id: getDeviceId(),
        user_agent: navigator.userAgent.slice(0, 200),
      },
      { onConflict: "user_id" }
    );
  } catch {
    // Non-fatal: the edge function will claim on first playback instead.
  }
}
