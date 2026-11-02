import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VideoService } from "../services/video.service";
import { formatDuration } from "../pages/CourseDetail";

/**
 * Free preview that starts on its own. Browsers only allow autoplay when the
 * video is muted, so it starts silent with a clear button to turn sound on.
 * If autoplay is blocked anyway (e.g. data saver), a play button is shown.
 */
export default function PreviewPlayer({
  lessonId,
  durationSeconds,
  withSound = false,
}: {
  lessonId: string | null;
  durationSeconds: number;
  /** The visitor tapped play to get here, so the browser may allow sound. */
  withSound?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const urlQuery = useQuery({
    queryKey: ["preview-url", lessonId],
    queryFn: () => VideoService.getPlaybackUrl(lessonId!),
    enabled: Boolean(lessonId),
    staleTime: 45 * 60_000,
    retry: 1,
  });

  function playWithSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    void video.play().catch(() => {});
  }

  const ready = Boolean(urlQuery.data?.url);

  // React does not render the `muted` attribute, and Chrome blocks autoplay
  // for videos that are not muted, so mute and start it here.
  useEffect(() => {
    const video = videoRef.current;
    if (!ready || !video) return;
    const startMuted = () => {
      video.defaultMuted = true;
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => {});
    };
    if (withSound) {
      video.muted = false;
      setMuted(false);
      video.play().catch(startMuted);
    } else {
      startMuted();
    }
  }, [ready, withSound]);

  return (
    <div className="rd-video" id="preview">
      {ready && (
        <video
          ref={videoRef}
          src={urlQuery.data!.url}
          autoPlay
          muted={muted}
          playsInline
          preload="auto"
          controls={!muted}
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}

      {playing && muted && (
        <button type="button" className="rd-sound" onClick={playWithSound}>
          <svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
          Daar codka
        </button>
      )}

      {!playing && (
        <button
          type="button"
          className="rd-video-overlay"
          onClick={playWithSound}
          disabled={!ready}
          aria-label="Daawo hordhaca bilaashka ah"
        >
          <span className="rd-play">
            <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg>
          </span>
        </button>
      )}

      {muted && (
        <span className="rd-video-tag">
          {!lessonId
            ? "Hordhac dhawaan"
            : urlQuery.isError
              ? "Lama soo saari karo"
              : `Hordhac bilaash ah${durationSeconds > 0 ? ` · ${formatDuration(durationSeconds)}` : ""}`}
        </span>
      )}
    </div>
  );
}
