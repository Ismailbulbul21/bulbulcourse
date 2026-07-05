import { invokeFunction } from "../lib/functions";

export interface PlaybackUrl {
  url: string;
  expires_in: number;
}

export const VideoService = {
  /**
   * Ask the get-video-url edge function for a short-lived signed Contabo URL.
   * The server checks purchase / preview / admin before signing.
   */
  getPlaybackUrl(lessonId: string): Promise<PlaybackUrl> {
    return invokeFunction<PlaybackUrl>("get-video-url", { lesson_id: lessonId });
  },
};
