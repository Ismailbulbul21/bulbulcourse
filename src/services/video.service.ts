import { invokeFunction } from "../lib/functions";
import { getDeviceId } from "../lib/device";

export interface PlaybackUrl {
  url: string;
  expires_in: number;
}

export const VideoService = {
  /**
   * Ask the get-video-url edge function for a short-lived signed Contabo URL.
   * The server checks purchase / preview / admin AND that this is the
   * account's active device before signing.
   */
  getPlaybackUrl(lessonId: string): Promise<PlaybackUrl> {
    return invokeFunction<PlaybackUrl>("get-video-url", {
      lesson_id: lessonId,
      device_id: getDeviceId(),
    });
  },
};
