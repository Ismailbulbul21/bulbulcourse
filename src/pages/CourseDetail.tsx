import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CourseService } from "../services/courses.service";
import { PurchaseService } from "../services/purchases.service";
import { useAuthStore } from "../stores/authStore";
import { formatPrice } from "../components/CourseCard";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "";
  if (totalSeconds < 60) return `${Math.max(1, Math.round(totalSeconds))}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => CourseService.getById(courseId!),
    enabled: Boolean(courseId),
  });

  const syllabusQuery = useQuery({
    queryKey: ["syllabus", courseId],
    queryFn: () => CourseService.syllabus(courseId!),
    enabled: Boolean(courseId),
  });

  const purchasedQuery = useQuery({
    queryKey: ["purchased", courseId, user?.id],
    queryFn: () => PurchaseService.hasPurchased(courseId!),
    enabled: Boolean(courseId && user),
  });

  if (courseQuery.isPending) return <Spinner label="Loading course…" />;
  if (courseQuery.isError) {
    return <ErrorMessage error={courseQuery.error} onRetry={() => courseQuery.refetch()} />;
  }

  const course = courseQuery.data;
  const purchased = purchasedQuery.data === true;
  const canWatchEverything = purchased || isAdmin;
  const syllabus = syllabusQuery.data ?? [];
  const lessonCount = syllabus.reduce((n, m) => n + m.lessons.length, 0);
  const previewCount = syllabus.reduce(
    (n, m) => n + m.lessons.filter((l) => l.is_preview).length,
    0
  );
  const totalDuration = syllabus.reduce(
    (n, m) => n + m.lessons.reduce((s, l) => s + l.duration_seconds, 0),
    0
  );

  function goToLesson(lessonId: string) {
    if (!user) {
      navigate("/signup", { state: { from: `/learn/${course.id}/${lessonId}` } });
      return;
    }
    navigate(`/learn/${course.id}/${lessonId}`);
  }

  function goToCheckout() {
    if (!user) {
      navigate("/signup", { state: { from: `/checkout/${course.id}` } });
      return;
    }
    navigate(`/checkout/${course.id}`);
  }

  return (
    <div className="page course-detail">
      <div className="course-detail-grid">
        {/* ── Left: what the course is ─────────────────────────── */}
        <div className="course-detail-main">
          <span className="badge badge-category">{course.category}</span>
          <h1>{course.title}</h1>
          <p className="course-detail-desc">{course.description}</p>
          <p className="course-detail-meta muted">
            {lessonCount} lessons
            {totalDuration > 0 && ` · ${formatDuration(totalDuration)} of video`}
            {previewCount > 0 && ` · ${previewCount} free preview`}
          </p>

          <section className="syllabus">
            <h2>Course content</h2>
            {syllabusQuery.isPending ? (
              <Spinner label="Loading syllabus…" />
            ) : syllabusQuery.isError ? (
              <ErrorMessage
                error={syllabusQuery.error}
                onRetry={() => syllabusQuery.refetch()}
              />
            ) : syllabus.length === 0 ? (
              <p className="muted">The syllabus will be published soon.</p>
            ) : (
              syllabus.map((mod, i) => (
                <details key={mod.id} className="syllabus-module" open={i === 0}>
                  <summary>
                    <span>{mod.title}</span>
                    <span className="muted">{mod.lessons.length} lessons</span>
                  </summary>
                  <ul>
                    {mod.lessons.map((lesson) => {
                      const watchable = canWatchEverything || lesson.is_preview;
                      return (
                        <li key={lesson.id}>
                          {/* The WHOLE row is the click target — tap anywhere
                              to watch (or to unlock when locked). */}
                          <button
                            type="button"
                            className={`syllabus-lesson ${
                              watchable ? "" : "syllabus-lesson-locked"
                            }`}
                            onClick={() =>
                              watchable ? goToLesson(lesson.id) : goToCheckout()
                            }
                            title={
                              watchable
                                ? "Watch this lesson"
                                : "Buy the course to unlock this lesson"
                            }
                          >
                            <span
                              className={`play-chip ${
                                watchable ? "" : "play-chip-locked"
                              }`}
                              aria-hidden
                            >
                              {watchable ? "▶" : "🔒"}
                            </span>
                            <span className="syllabus-lesson-title">
                              {lesson.title}
                              {lesson.is_preview && !canWatchEverything && (
                                <span className="badge badge-preview">
                                  Free preview
                                </span>
                              )}
                            </span>
                            <span className="syllabus-lesson-right">
                              {lesson.duration_seconds > 0 && (
                                <span>{formatDuration(lesson.duration_seconds)}</span>
                              )}
                              {watchable ? (
                                <span className="syllabus-go">Watch ›</span>
                              ) : (
                                <span className="syllabus-locktext">Unlock</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))
            )}
          </section>

          {!user && (
            <p className="muted">
              <Link to="/signup">Create a free account</Link> to watch preview lessons.
            </p>
          )}
        </div>

        {/* ── Right: how to get it (sticky purchase panel) ─────── */}
        <aside className="purchase-card">
          <div className="purchase-thumb">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} />
            ) : (
              <div className="thumb-placeholder" aria-hidden>
                {course.title.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="purchase-body">
            {canWatchEverything ? (
              <>
                <div className="purchase-owned">✓ You own this course</div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={() => navigate(`/learn/${course.id}`)}
                >
                  ▶ Continue learning
                </button>
              </>
            ) : (
              <>
                <div className="purchase-price">
                  {formatPrice(course.price, course.currency)}
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={goToCheckout}
                >
                  {course.price > 0 ? "Buy this course" : "Enroll for free"}
                </button>
                <p className="purchase-note">
                  Pay with <strong>EVC Plus</strong> or <strong>ZAAD</strong> — start
                  watching immediately.
                </p>
              </>
            )}

            <ul className="purchase-features">
              <li>
                <span aria-hidden>🎬</span> {lessonCount} video lessons
              </li>
              {totalDuration > 0 && (
                <li>
                  <span aria-hidden>⏱️</span> {formatDuration(totalDuration)} of content
                </li>
              )}
              {previewCount > 0 && !canWatchEverything && (
                <li>
                  <span aria-hidden>👀</span> {previewCount} free preview lesson
                  {previewCount > 1 ? "s" : ""}
                </li>
              )}
              <li>
                <span aria-hidden>📱</span> EVC Plus &amp; ZAAD accepted
              </li>
              <li>
                <span aria-hidden>♾️</span> Lifetime access, learn at your pace
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
