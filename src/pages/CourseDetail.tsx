import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CourseService } from "../services/courses.service";
import { PurchaseService } from "../services/purchases.service";
import { useAuthStore } from "../stores/authStore";
import { discountPct, formatPrice, hasDiscount } from "../components/CourseCard";
import CourseComments from "../components/CourseComments";
import PreviewPlayer from "../components/PreviewPlayer";
import WhatsAppGroup from "../components/WhatsAppGroup";
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
  const location = useLocation();
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

  const loaded = Boolean(courseQuery.data);
  useEffect(() => {
    if (loaded && location.hash === "#preview") {
      document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loaded, location.hash]);

  if (courseQuery.isPending) return <Spinner label="Koorsada ayaa la soo saarayaa…" />;
  if (courseQuery.isError) {
    return <ErrorMessage error={courseQuery.error} onRetry={() => courseQuery.refetch()} />;
  }

  const course = courseQuery.data;
  const purchased = purchasedQuery.data === true;
  const canWatchEverything = purchased || isAdmin;
  const comingSoon = course.status === "coming_soon";
  const syllabus = syllabusQuery.data ?? [];
  const lessons = syllabus.flatMap((m) => m.lessons);
  const totalDuration = lessons.reduce((s, l) => s + l.duration_seconds, 0);
  const trailer = lessons.find((l) => l.is_preview && l.has_video) ?? null;
  const discounted = hasDiscount(course);
  const isFree = Number(course.price) <= 0;

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

  const buyButton = comingSoon ? (
    <span className="rd-soon">Goordhow</span>
  ) : canWatchEverything ? (
    <button type="button" className="rd-btn rd-btn-primary" onClick={() => navigate(`/learn/${course.id}`)}>
      ▶ Sii wad barashada
    </button>
  ) : (
    <button type="button" className="rd-btn rd-buy-btn" onClick={goToCheckout}>
      {isFree ? "Isku diiwaan geli bilaash" : "Iibso koorsada"}
      <span aria-hidden>→</span>
    </button>
  );

  return (
    <div className="rd rd-course">
      <header className="rd-ch">
        <div className="rd-ch-title">
          <span className="rd-ch-meta">
            {course.category === "Mobile" ? "Mobile App" : course.category}
            {lessons.length > 0 && ` · ${lessons.length} cashar`}
            {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
          </span>
          <h1>{course.title}</h1>
        </div>
        <div className="rd-ch-buy">
          {!comingSoon && !canWatchEverything && (
            <div className="rd-ch-price">
              {discounted && <s>{formatPrice(course.compare_at_price!, course.currency)}</s>}
              <b>{formatPrice(course.price, course.currency)}</b>
              {discounted && <span className="rd-save">-{discountPct(course)}%</span>}
            </div>
          )}
          {buyButton}
        </div>
      </header>

      <div className="rd-cgrid">
        <PreviewPlayer
          lessonId={trailer?.id ?? null}
          durationSeconds={trailer?.duration_seconds ?? 0}
          withSound={(location.state as { playPreview?: boolean } | null)?.playPreview === true}
        />

        <aside className="rd-clist">
          {!comingSoon && (
            <WhatsAppGroup courseId={course.id} canJoin={canWatchEverything} onBuy={goToCheckout} />
          )}
          <div className="rd-clist-head">
            <h2>Waxa koorsada ku jira</h2>
            <span>{syllabus.length} qaybood · {lessons.length} cashar</span>
          </div>
          {syllabusQuery.isPending ? (
            <Spinner label="Casharrada ayaa la soo saarayaa…" />
          ) : syllabusQuery.isError ? (
            <ErrorMessage error={syllabusQuery.error} onRetry={() => syllabusQuery.refetch()} />
          ) : syllabus.length === 0 ? (
            <p className="muted">Casharrada dhawaan ayaa la soo gelinayaa.</p>
          ) : (
            <div className="rd-modules">
              {syllabus.map((mod, i) => (
                <details key={mod.id} className="rd-module" open={i < 2}>
                  <summary>
                    <span className="rd-module-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="rd-module-text">
                      <span className="rd-module-title">{mod.title}</span>
                      <span className="rd-module-meta">{mod.lessons.length} cashar</span>
                    </span>
                    <span className="rd-module-toggle" aria-hidden>
                      <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
                    </span>
                  </summary>
                  <ul>
                    {mod.lessons.map((lesson) => {
                      const watchable = canWatchEverything || lesson.is_preview;
                      return (
                        <li key={lesson.id}>
                          <button
                            type="button"
                            className={`rd-lesson ${watchable ? "" : "rd-lesson-locked"}`}
                            onClick={() => (watchable ? goToLesson(lesson.id) : goToCheckout())}
                          >
                            <span className="rd-lesson-icon" aria-hidden>{watchable ? "▶" : "🔒"}</span>
                            <span className="rd-lesson-title">{lesson.title}</span>
                            {lesson.is_preview && !canWatchEverything && <span className="rd-free">Bilaash</span>}
                            {lesson.duration_seconds > 0 && (
                              <span className="rd-lesson-time">{formatDuration(lesson.duration_seconds)}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          )}
          {!comingSoon && !canWatchEverything && (
            <p className="rd-paynote">Ku bixi EVC Plus, ZAAD ama Sahal · Weligaa adiga ayay kuu furan tahay</p>
          )}
        </aside>
      </div>

      {!comingSoon && canWatchEverything && (
        <section className="rd-section">
          <CourseComments courseId={course.id} currentUserId={user!.id} isAdmin={isAdmin} />
        </section>
      )}

      {!comingSoon && !canWatchEverything && (
        <div className="rd-sticky">
          <div>
            <b>{formatPrice(course.price, course.currency)}</b>
            {discounted && <s>{formatPrice(course.compare_at_price!, course.currency)}</s>}
          </div>
          <button type="button" className="rd-btn rd-buy-btn" onClick={goToCheckout}>
            {isFree ? "Isku diiwaan geli" : "Iibso koorsada"}
            <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  );
}
