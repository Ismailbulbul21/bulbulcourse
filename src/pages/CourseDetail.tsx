import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CourseService } from "../services/courses.service";
import { PurchaseService } from "../services/purchases.service";
import { LiveService, formatRunDates } from "../services/live.service";
import { useAuthStore } from "../stores/authStore";
import { discountPct, formatPrice, hasDiscount } from "../components/CourseCard";
import { LiveSchedule, WhatsappJoinCard } from "../components/LiveCoursePanel";
import CourseComments from "../components/CourseComments";
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

  const isLiveCourse = courseQuery.data?.course_type === "live";

  const syllabusQuery = useQuery({
    queryKey: ["syllabus", courseId],
    queryFn: () => CourseService.syllabus(courseId!),
    enabled: Boolean(courseId) && courseQuery.isSuccess && !isLiveCourse,
  });

  const liveSessionsQuery = useQuery({
    queryKey: ["live-sessions", courseId],
    queryFn: () => LiveService.sessions(courseId!),
    enabled: Boolean(courseId) && courseQuery.isSuccess && isLiveCourse,
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
  const isLive = course.course_type === "live";
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

  const classCount = liveSessionsQuery.data?.length ?? 0;
  const runDates = formatRunDates(course.live_starts_on, course.live_ends_on);

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
          <div className="course-detail-badges">
            <span className="badge badge-category">{course.category}</span>
            {isLive && <span className="badge badge-live">🔴 KOORSO TOOS AH</span>}
          </div>
          <h1>{course.title}</h1>
          <p className="course-detail-desc">{course.description}</p>

          {isLive ? (
            <p className="course-detail-meta muted">
              {classCount > 0 && `${classCount} fasal oo toos ah`}
              {runDates && `${classCount > 0 ? " · " : ""}${runDates}`}
            </p>
          ) : (
            <p className="course-detail-meta muted">
              {lessonCount} lessons
              {totalDuration > 0 && ` · ${formatDuration(totalDuration)} of video`}
              {previewCount > 0 && ` · ${previewCount} free preview`}
            </p>
          )}

          {isLive ? (
            <section className="syllabus">
              <h2>
                Fasallada <span className="bi-en">Class schedule</span>
              </h2>
              <LiveSchedule courseId={course.id} />
            </section>
          ) : (
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
                syllabus.map((mod) => (
                  <div key={mod.id} className="syllabus-module">
                    <div className="syllabus-module-head">
                      <span>{mod.title}</span>
                      <span className="muted">{mod.lessons.length} lessons</span>
                    </div>
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
                  </div>
                ))
              )}
            </section>
          )}

          {!user && !isLive && (
            <p className="muted">
              <Link to="/signup">Create a free account</Link> to watch preview lessons.
            </p>
          )}

          {course.status === "coming_soon" ? null : canWatchEverything ? (
            <CourseComments courseId={course.id} currentUserId={user!.id} isAdmin={isAdmin} />
          ) : (
            <section className="comments comments-locked">
              <h2>
                Su'aalo &amp; Talo <span className="bi-en">Questions &amp; feedback</span>
              </h2>
              <p className="muted">
                🔒 Buy this course to ask questions, report issues, and get replies
                from the instructor.
              </p>
            </section>
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
            {isLive && <span className="live-badge">🔴 TOOS</span>}
          </div>

          <div className="purchase-body">
            {course.status === "coming_soon" ? (
              <div className="coming-soon-panel">
                <div className="coming-soon-badge-big">🔜 GOORDHOW</div>
                <p>
                  Koorsadan waxay furmaysaa <strong>Goordhow</strong>. Soo laabo si
                  aad u iibsato marka la furo!
                </p>
              </div>
            ) : canWatchEverything ? (
              isLive ? (
                <>
                  <div className="purchase-owned">✓ Waad iibsatay koorsadan</div>
                  <WhatsappJoinCard courseId={course.id} />
                </>
              ) : (
                <>
                  <div className="purchase-owned">✓ Waad iibsatay koorsadan</div>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg btn-block"
                    onClick={() => navigate(`/learn/${course.id}`)}
                  >
                    ▶ Sii wad barashada
                  </button>
                </>
              )
            ) : (
              <>
                <span className="purchase-price-label">Lacagta</span>
                {hasDiscount(course) && (
                  <div className="purchase-old-row">
                    <s className="price-old">
                      {formatPrice(course.compare_at_price!, course.currency)}
                    </s>
                    <span className="discount-chip">
                      -{discountPct(course)}% qiimo dhimis
                    </span>
                  </div>
                )}
                <div className="purchase-price">
                  {formatPrice(course.price, course.currency)}
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={goToCheckout}
                >
                  {course.price > 0
                    ? isLive
                      ? "Iibso oo ku biir"
                      : "Iibso koorsada"
                    : "Isku diiwaan geli bilaash"}
                </button>
                <p className="purchase-note">
                  Ku bixi <strong>EVC Plus</strong>, <strong>ZAAD</strong> ama{" "}
                  <strong>Sahal</strong>
                  {isLive
                    ? " — isla markiiba waxaad heli doontaa link-ga group-ka."
                    : " — isla markiiba bilow daawashada."}
                </p>
              </>
            )}

            {course.status !== "coming_soon" &&
              (isLive ? (
                <ul className="purchase-features">
                  {classCount > 0 && (
                    <li>
                      <span aria-hidden>🔴</span> {classCount} fasal oo toos ah
                    </li>
                  )}
                  {runDates && (
                    <li>
                      <span aria-hidden>📅</span> {runDates}
                    </li>
                  )}
                  <li>
                    <span aria-hidden>💬</span> Group WhatsApp ah oo gaar ah
                  </li>
                  <li>
                    <span aria-hidden>🙋</span> Su'aalo toos ah macallinka weydii
                  </li>
                  <li>
                    <span aria-hidden>📱</span> EVC Plus, ZAAD &amp; Sahal waa la aqbalaa
                  </li>
                </ul>
              ) : (
                <ul className="purchase-features">
                  <li>
                    <span aria-hidden>🎬</span> {lessonCount} casharo fiidyow ah
                  </li>
                  {totalDuration > 0 && (
                    <li>
                      <span aria-hidden>⏱️</span> {formatDuration(totalDuration)} oo casharro ah
                    </li>
                  )}
                  {previewCount > 0 && !canWatchEverything && (
                    <li>
                      <span aria-hidden>👀</span> {previewCount} cashar oo bilaash ah oo la
                      daawan karo
                    </li>
                  )}
                  <li>
                    <span aria-hidden>📱</span> EVC Plus, ZAAD &amp; Sahal waa la aqbalaa
                  </li>
                  <li>
                    <span aria-hidden>♾️</span> Helitaan joogto ah — waligaa
                  </li>
                </ul>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
