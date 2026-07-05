import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CourseForm from "../../components/admin/CourseForm";
import CurriculumEditor from "../../components/admin/CurriculumEditor";
import { CourseService } from "../../services/courses.service";
import { ModuleService } from "../../services/modules.service";
import { StorageService } from "../../services/storage.service";
import Spinner from "../../components/Spinner";
import ErrorMessage from "../../components/ErrorMessage";
import type { CourseInput } from "../../schemas/course.schema";

type Tab = "details" | "curriculum" | "publish";

export default function CourseEditor() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "details";
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

  const modulesQuery = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: () => ModuleService.listWithLessons(courseId!),
    enabled: Boolean(courseId),
  });

  function invalidateCourse() {
    void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
  }

  const setStatus = useMutation({
    mutationFn: (status: "draft" | "published" | "archived") =>
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

  function switchTab(next: Tab) {
    setSearchParams({ tab: next });
  }

  async function saveDetails(values: CourseInput) {
    setDetailsError(null);
    setDetailsSaved(false);
    try {
      await CourseService.update(course.id, {
        title: values.title,
        description: values.description,
        category: values.category,
        price: Number(values.price),
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
        <span className={`badge badge-${course.status}`}>{course.status}</span>
      </div>

      <div className="tabs">
        {(["details", "curriculum", "publish"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? "tab-active" : ""}`}
            onClick={() => switchTab(t)}
          >
            {t === "details" ? "1 · Details" : t === "curriculum" ? "2 · Curriculum" : "3 · Publish"}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="editor-panel">
          <div className="card">
            {detailsSaved && <div className="success-box">Course details saved.</div>}
            <CourseForm
              defaultValues={{
                title: course.title,
                description: course.description,
                category: (course.category === "Web Development"
                  ? "Web Development"
                  : "Mobile") as CourseInput["category"],
                price: String(course.price),
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

      {tab === "publish" && (
        <div className="card publish-panel">
          <h3>Ready to publish?</h3>
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

          {setStatus.isError && <ErrorMessage error={setStatus.error} />}

          <div className="publish-actions">
            {course.status !== "published" ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={lessonCount === 0 || setStatus.isPending}
                onClick={() => setStatus.mutate("published")}
              >
                {setStatus.isPending ? "Publishing…" : "🚀 Publish course"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate("draft")}
              >
                Unpublish (back to draft)
              </button>
            )}
          </div>
          {lessonCount === 0 && (
            <p className="muted">Add at least one lesson before publishing.</p>
          )}
          {lessonsWithVideo < lessonCount && lessonCount > 0 && (
            <p className="muted">
              You can publish now, but lessons without video will show "No video yet"
              to students.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
