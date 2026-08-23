import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CourseForm from "../../components/admin/CourseForm";
import CurriculumEditor from "../../components/admin/CurriculumEditor";
import LiveClassesEditor from "../../components/admin/LiveClassesEditor";
import { CourseService } from "../../services/courses.service";
import { ModuleService } from "../../services/modules.service";
import { StorageService } from "../../services/storage.service";
import { LiveService } from "../../services/live.service";
import Spinner from "../../components/Spinner";
import ErrorMessage from "../../components/ErrorMessage";
import type { CourseInput } from "../../schemas/course.schema";

type Tab = "details" | "curriculum" | "live" | "publish";

export default function CourseEditor() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => CourseService.getById(courseId!),
    enabled: Boolean(courseId),
  });

  const isLive = courseQuery.data?.course_type === "live";

  const modulesQuery = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: () => ModuleService.listWithLessons(courseId!),
    enabled: Boolean(courseId) && courseQuery.isSuccess && !isLive,
  });

  const sessionsQuery = useQuery({
    queryKey: ["live-sessions", courseId],
    queryFn: () => LiveService.sessions(courseId!),
    enabled: Boolean(courseId) && courseQuery.isSuccess && isLive,
  });

  const waQuery = useQuery({
    queryKey: ["live-whatsapp", courseId],
    queryFn: () => LiveService.whatsappUrl(courseId!),
    enabled: Boolean(courseId) && courseQuery.isSuccess && isLive,
  });

  function invalidateCourse() {
    void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
  }

  const setStatus = useMutation({
    mutationFn: (status: "draft" | "coming_soon" | "published" | "archived") =>
      CourseService.update(courseId!, { status }),
    onSuccess: invalidateCourse,
  });

  if (courseQuery.isPending) return <Spinner label="Loading course…" />;
  if (courseQuery.isError) {
    return <ErrorMessage error={courseQuery.error} onRetry={() => courseQuery.refetch()} />;
  }

  const course = courseQuery.data;
  const modules = modulesQuery.data ?? [];
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  const lessonsWithVideo = modules.reduce(
    (n, m) => n + m.lessons.filter((l) => l.video_key).length,
    0
  );
  const sessions = sessionsQuery.data ?? [];
  const hasWhatsapp = Boolean(waQuery.data);

  // A live course is ready when it has classes and a group link; a recorded
  // course still needs lessons, exactly as before.
  const readyToPublish = isLive ? sessions.length > 0 && hasWhatsapp : lessonCount > 0;

  const contentTab: Tab = isLive ? "live" : "curriculum";
  const tabs: Tab[] = ["details", contentTab, "publish"];
  const requested = (searchParams.get("tab") as Tab) || "details";
  const tab: Tab = tabs.includes(requested) ? requested : "details";

  function switchTab(next: Tab) {
    setSearchParams({ tab: next });
  }

  function tabLabel(t: Tab): string {
    if (t === "details") return "1 · Details";
    if (t === "curriculum") return "2 · Curriculum";
    if (t === "live") return "2 · Live classes";
    return "3 · Publish";
  }

  async function saveDetails(values: CourseInput) {
    setDetailsError(null);
    setDetailsSaved(false);
    try {
      const live = values.course_type === "live";
      await CourseService.update(course.id, {
        title: values.title,
        description: values.description,
        category: values.category,
        price: Number(values.price),
        compare_at_price:
          values.compare_at_price.trim() !== "" && Number(values.compare_at_price) > 0
            ? Number(values.compare_at_price)
            : null,
        live_starts_on: live && values.live_starts_on ? values.live_starts_on : null,
        live_ends_on: live && values.live_ends_on ? values.live_ends_on : null,
      });
      invalidateCourse();
      setDetailsSaved(true);
    } catch (e) {
      setDetailsError(e instanceof Error ? e.message : "Could not save the course.");
    }
  }

  async function uploadThumbnail(file: File) {
    setThumbUploading(true);
    setDetailsError(null);
    try {
      const url = await StorageService.uploadThumbnail(course.id, file);
      await CourseService.update(course.id, { thumbnail_url: url });
      invalidateCourse();
    } catch (e) {
      setDetailsError(e instanceof Error ? e.message : "Thumbnail upload failed.");
    } finally {
      setThumbUploading(false);
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/admin" className="muted">
            ← All courses
          </Link>
          <h1>{course.title}</h1>
        </div>
        <div className="page-header-badges">
          {isLive && <span className="badge badge-live">🔴 TOOS</span>}
          <span className={`badge badge-${course.status}`}>{course.status}</span>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? "tab-active" : ""}`}
            onClick={() => switchTab(t)}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="editor-panel">
          <div className="card">
            {detailsSaved && <div className="success-box">Course details saved.</div>}
            <CourseForm
              lockType
              defaultValues={{
                title: course.title,
                description: course.description,
                category: (course.category === "Web Development"
                  ? "Web Development"
                  : "Mobile") as CourseInput["category"],
                price: String(course.price),
                compare_at_price:
                  course.compare_at_price != null ? String(course.compare_at_price) : "",
                course_type: course.course_type,
                live_starts_on: course.live_starts_on ?? "",
                live_ends_on: course.live_ends_on ?? "",
              }}
              submitLabel="Save details"
              onSubmit={saveDetails}
              serverError={detailsError}
            />
          </div>

          <div className="card thumbnail-card">
            <h3>Thumbnail</h3>
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt="Course thumbnail" className="thumbnail-preview" />
            ) : (
              <p className="muted">No thumbnail yet. A good image sells the course.</p>
            )}
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              disabled={thumbUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadThumbnail(file);
              }}
            />
            {thumbUploading && <Spinner label="Uploading thumbnail…" />}
          </div>
        </div>
      )}

      {tab === "curriculum" && <CurriculumEditor courseId={course.id} />}

      {tab === "live" && <LiveClassesEditor courseId={course.id} />}

      {tab === "publish" && (
        <div className="card publish-panel">
          {course.status === "published" ? (
            <div className="status-banner status-live">
              <div>
                <strong>✓ This course is LIVE</strong>
                <p className="muted">
                  Students can find it in the catalog and buy it.
                </p>
              </div>
              <a
                href={`/course/${course.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                View in catalog ↗
              </a>
            </div>
          ) : course.status === "coming_soon" ? (
            <div className="status-banner status-soon">
              <div>
                <strong>🔜 This course shows as COMING SOON</strong>
                <p className="muted">
                  Students see it in the catalog as upcoming, but cannot buy or
                  watch it yet. Publish it when it's ready.
                </p>
              </div>
              <a
                href={`/course/${course.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                View in catalog ↗
              </a>
            </div>
          ) : (
            <div className="status-banner status-draft">
              <div>
                <strong>● This course is a DRAFT</strong>
                <p className="muted">
                  It is hidden — students cannot see it in Courses until you
                  publish it.
                </p>
              </div>
            </div>
          )}

          <h3>Publish checklist</h3>
          {isLive ? (
            <ul className="publish-checklist">
              <li className={sessions.length > 0 ? "check-ok" : "check-missing"}>
                {sessions.length > 0 ? "✓" : "○"} At least one class ({sessions.length})
              </li>
              <li className={hasWhatsapp ? "check-ok" : "check-missing"}>
                {hasWhatsapp ? "✓" : "○"} WhatsApp group link added
              </li>
              <li className={course.live_starts_on ? "check-ok" : "check-missing"}>
                {course.live_starts_on ? "✓" : "○"} Start date set
              </li>
              <li className={course.thumbnail_url ? "check-ok" : "check-missing"}>
                {course.thumbnail_url ? "✓" : "○"} Thumbnail added
              </li>
            </ul>
          ) : (
            <ul className="publish-checklist">
              <li className={modules.length > 0 ? "check-ok" : "check-missing"}>
                {modules.length > 0 ? "✓" : "○"} At least one module ({modules.length})
              </li>
              <li className={lessonCount > 0 ? "check-ok" : "check-missing"}>
                {lessonCount > 0 ? "✓" : "○"} At least one lesson ({lessonCount})
              </li>
              <li className={lessonsWithVideo === lessonCount && lessonCount > 0 ? "check-ok" : "check-missing"}>
                {lessonsWithVideo === lessonCount && lessonCount > 0 ? "✓" : "○"} Videos uploaded (
                {lessonsWithVideo} of {lessonCount})
              </li>
              <li className={course.thumbnail_url ? "check-ok" : "check-missing"}>
                {course.thumbnail_url ? "✓" : "○"} Thumbnail added
              </li>
            </ul>
          )}

          {setStatus.isError && <ErrorMessage error={setStatus.error} />}

          {!readyToPublish && course.status !== "published" && (
            <div className="error-box">
              {isLive ? (
                <>
                  You can't publish yet. Open the <strong>Live classes</strong> tab, add at
                  least one class and paste the WhatsApp group link, then come back here.
                </>
              ) : (
                <>
                  You can't publish yet — this course has no lessons. Open the{" "}
                  <strong>Curriculum</strong> tab, add a module and at least one lesson,
                  then come back here.
                </>
              )}
            </div>
          )}

          <div className="publish-actions">
            {course.status !== "published" ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={!readyToPublish || setStatus.isPending}
                  onClick={() => setStatus.mutate("published")}
                >
                  {setStatus.isPending ? "Publishing…" : "🚀 Publish course"}
                </button>
                {course.status !== "coming_soon" ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    disabled={setStatus.isPending}
                    title="Show in the catalog as upcoming — no lessons needed yet"
                    onClick={() => setStatus.mutate("coming_soon")}
                  >
                    🔜 Show as Coming Soon
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={setStatus.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remove this course from the catalog and move it back to draft?"
                        )
                      ) {
                        setStatus.mutate("draft");
                      }
                    }}
                  >
                    Hide (back to draft)
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={setStatus.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Hide this course from students and move it back to draft?"
                    )
                  ) {
                    setStatus.mutate("draft");
                  }
                }}
              >
                Unpublish (hide from students)
              </button>
            )}
          </div>
          {!isLive && lessonsWithVideo < lessonCount && lessonCount > 0 && (
            <p className="muted">
              Lessons without a video will show "No video yet" to students.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
