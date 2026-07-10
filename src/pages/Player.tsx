import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CourseService } from "../services/courses.service";
import { ModuleService } from "../services/modules.service";
import { ProgressService } from "../services/progress.service";
import { VideoService } from "../services/video.service";
import { useAuthStore } from "../stores/authStore";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import { formatDuration } from "./CourseDetail";
import type { Lesson, Progress } from "../types/db";

const SAVE_INTERVAL_MS = 10_000;

export default function Player() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId?: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => CourseService.getById(courseId!),
    enabled: Boolean(courseId),
  });

  // Full outline (all lessons, safe fields) — shows locked lessons too.
  const syllabusQuery = useQuery({
    queryKey: ["syllabus", courseId],
    queryFn: () => CourseService.syllabus(courseId!),
    enabled: Boolean(courseId),
  });

  // Full lesson rows the current user is entitled to (RLS enforced).
  const accessQuery = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: () => ModuleService.listWithLessons(courseId!),
    enabled: Boolean(courseId),
  });

  const progressQuery = useQuery({
    queryKey: ["progress", courseId],
    queryFn: () => ProgressService.forCourse(courseId!),
    enabled: Boolean(courseId),
  });

  const accessible = useMemo(() => {
    const map = new Map<string, Lesson>();
    for (const mod of accessQuery.data ?? []) {
      for (const lesson of mod.lessons ?? []) map.set(lesson.id, lesson);
    }
    return map;
  }, [accessQuery.data]);

  const outline = syllabusQuery.data ?? [];
  const orderedLessons = useMemo(
    () => outline.flatMap((m) => m.lessons),
    [outline]
  );

  const [progressMap, setProgressMap] = useState<Record<string, Progress>>({});
  useEffect(() => {
    if (progressQuery.data) {
      setProgressMap(
        Object.fromEntries(progressQuery.data.map((p) => [p.lesson_id, p]))
      );
    }
  }, [progressQuery.data]);

  // Current lesson: URL param, otherwise first unfinished accessible lesson.
  const currentId =
    lessonId ??
    orderedLessons.find((l) => accessible.has(l.id) && !progressMap[l.id]?.completed)?.id ??
    orderedLessons.find((l) => accessible.has(l.id))?.id;

  useEffect(() => {
    if (!lessonId && currentId && courseId) {
      navigate(`/learn/${courseId}/${currentId}`, { replace: true });
    }
  }, [lessonId, currentId, courseId, navigate]);

  const currentLesson = currentId ? accessible.get(currentId) : undefined;
  const currentOutline = orderedLessons.find((l) => l.id === currentId);
  const isLocked = Boolean(currentId && currentOutline && !currentLesson);

  const videoQuery = useQuery({
    queryKey: ["video-url", currentId],
    queryFn: () => VideoService.getPlaybackUrl(currentId!),
    enabled: Boolean(currentLesson?.video_key),
    staleTime: 45 * 60_000, // signed URLs live 60min — refresh before expiry
    gcTime: 50 * 60_000,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedAtRef = useRef(0);
  const positionRef = useRef(0);

  // Save the position when leaving a lesson (switch or unmount).
  useEffect(() => {
    positionRef.current = 0;
    lastSavedAtRef.current = 0;
    return () => {
      if (currentId && courseId && positionRef.current > 0) {
        void ProgressService.savePosition(
          currentId,
          courseId,
          positionRef.current
        ).catch(() => {});
      }
    };
  }, [currentId, courseId]);

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !currentId || !courseId) return;
    positionRef.current = video.currentTime;
    const now = Date.now();
    if (now - lastSavedAtRef.current >= SAVE_INTERVAL_MS) {
      lastSavedAtRef.current = now;
      void ProgressService.savePosition(currentId, courseId, video.currentTime).catch(
        () => {}
      );
      setProgressMap((m) => ({
        ...m,
        [currentId]: {
          ...(m[currentId] ?? {
            id: "",
            user_id: "",
            lesson_id: currentId,
            course_id: courseId,
            completed: false,
            updated_at: "",
            last_position_seconds: 0,
          }),
          last_position_seconds: video.currentTime,
        },
      }));
    }
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video || !currentId) return;
    const saved = progressMap[currentId];
    if (
      saved &&
      !saved.completed &&
      saved.last_position_seconds > 5 &&
      saved.last_position_seconds < video.duration - 5
    ) {
      video.currentTime = saved.last_position_seconds;
    }
    // Start playing right away — the user already clicked the lesson.
    // (Browsers may block autoplay-with-sound before any interaction;
    // ignore the rejection in that case.)
    void video.play().catch(() => {});
  }

  function handleEnded() {
    if (!currentId || !courseId) return;
    void ProgressService.markCompleted(
      currentId,
      courseId,
      videoRef.current?.duration ?? 0
    ).catch(() => {});
    setProgressMap((m) => ({
      ...m,
      [currentId]: {
        ...(m[currentId] ?? {
          id: "",
          user_id: "",
          lesson_id: currentId,
          course_id: courseId,
          updated_at: "",
          last_position_seconds: 0,
        }),
        completed: true,
        last_position_seconds: videoRef.current?.duration ?? 0,
      },
    }));
    const next = nextLessonId();
    if (next && accessible.has(next)) {
      navigate(`/learn/${courseId}/${next}`);
    }
  }

  function currentIndex(): number {
    return orderedLessons.findIndex((l) => l.id === currentId);
  }
  function prevLessonId(): string | undefined {
    const i = currentIndex();
    return i > 0 ? orderedLessons[i - 1].id : undefined;
  }
  function nextLessonId(): string | undefined {
    const i = currentIndex();
    return i >= 0 && i < orderedLessons.length - 1
      ? orderedLessons[i + 1].id
      : undefined;
  }

  if (courseQuery.isPending || syllabusQuery.isPending || accessQuery.isPending) {
    return <Spinner label="Loading course…" />;
  }
  if (courseQuery.isError) {
    return <ErrorMessage error={courseQuery.error} onRetry={() => courseQuery.refetch()} />;
  }
  if (accessQuery.isError) {
    return <ErrorMessage error={accessQuery.error} onRetry={() => accessQuery.refetch()} />;
  }

  const course = courseQuery.data;
  const completedCount = orderedLessons.filter((l) => progressMap[l.id]?.completed).length;
  const prevId = prevLessonId();
  const nextId = nextLessonId();
  const nextAccessible = nextId ? accessible.has(nextId) : false;
  const hasAnyAccess = accessible.size > 0;

  return (
    <div className="player-page">
      <div className="player-main">
        <div className="player-breadcrumb">
          <Link to={`/course/${course.id}`}>← {course.title}</Link>
          <span className="muted">
            {completedCount} of {orderedLessons.length} lessons completed
          </span>
        </div>

        {!hasAnyAccess ? (
          <div className="player-locked card">
            <h2>This course is locked</h2>
            <p>Buy the course to start watching the lessons.</p>
            <Link to={`/checkout/${course.id}`} className="btn btn-primary btn-lg">
              Buy this course
            </Link>
          </div>
        ) : isLocked ? (
          <div className="player-locked card">
            <h2>🔒 {currentOutline?.title}</h2>
            <p>This lesson is part of the paid course.</p>
            <Link to={`/checkout/${course.id}`} className="btn btn-primary btn-lg">
              Unlock the full course
            </Link>
          </div>
        ) : currentLesson ? (
          <>
            <div className="video-frame" onContextMenu={(e) => e.preventDefault()}>
              {!currentLesson.video_key ? (
                <div className="video-empty">
                  <p>No video has been uploaded for this lesson yet.</p>
                </div>
              ) : videoQuery.isPending ? (
                <div className="video-empty">
                  <Spinner label="Preparing secure video…" />
                </div>
              ) : videoQuery.isError ? (
                <div className="video-empty">
                  <ErrorMessage
                    error={videoQuery.error}
                    onRetry={() => videoQuery.refetch()}
                  />
                </div>
              ) : (
                <video
                  key={videoQuery.data.url}
                  ref={videoRef}
                  src={videoQuery.data.url}
                  controls
                  autoPlay
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  playsInline
                  preload="auto"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleEnded}
                />
              )}
            </div>

            <div className="player-nav">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!prevId}
                onClick={() => prevId && navigate(`/learn/${course.id}/${prevId}`)}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!nextId}
                title={nextId && !nextAccessible ? "Buy the course to unlock" : undefined}
                onClick={() => {
                  if (!nextId) return;
                  if (nextAccessible) navigate(`/learn/${course.id}/${nextId}`);
                  else navigate(`/checkout/${course.id}`);
                }}
              >
                Next →
              </button>
            </div>

            <div className="lesson-info">
              <h1>{currentLesson.title}</h1>
              {currentLesson.description && <p>{currentLesson.description}</p>}
              {currentLesson.resources.length > 0 && (
                <div className="lesson-resources">
                  <h3>Resources</h3>
                  <ul>
                    {currentLesson.resources.map((r) => (
                      <li key={r.url}>
                        <a href={r.url} target="_blank" rel="noreferrer">
                          📄 {r.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="player-locked card">
            <h2>No lessons available yet</h2>
            <p>Check back soon.</p>
          </div>
        )}
      </div>

      <aside className="player-sidebar">
        <div className="sidebar-progress">
          <div className="sidebar-progress-top">
            <span className="sidebar-progress-title">Horumarkaaga</span>
            <span className="sidebar-progress-nums">
              {completedCount}/{orderedLessons.length}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${
                  orderedLessons.length > 0
                    ? Math.round((completedCount / orderedLessons.length) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {outline.map((mod) => (
          <div key={mod.id} className="outline-module">
            <div className="outline-module-head">{mod.title}</div>
            <ul>
              {mod.lessons.map((lesson) => {
                const unlocked = accessible.has(lesson.id) || isAdmin;
                const done = progressMap[lesson.id]?.completed;
                const active = lesson.id === currentId;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      className={`outline-lesson ${
                        active ? "outline-lesson-active" : ""
                      } ${done ? "outline-lesson-done" : ""}`}
                      onClick={() => {
                        if (unlocked) navigate(`/learn/${course.id}/${lesson.id}`);
                        else navigate(`/checkout/${course.id}`);
                      }}
                    >
                      <span
                        className={`outline-chip ${
                          done
                            ? "outline-chip-done"
                            : unlocked
                              ? "outline-chip-play"
                              : "outline-chip-locked"
                        }`}
                        aria-hidden
                      >
                        {done ? "✓" : unlocked ? "▶" : "🔒"}
                      </span>
                      <span className="outline-lesson-title">{lesson.title}</span>
                      {lesson.duration_seconds > 0 && (
                        <span className="outline-lesson-duration">
                          {formatDuration(lesson.duration_seconds)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>
    </div>
  );
}
