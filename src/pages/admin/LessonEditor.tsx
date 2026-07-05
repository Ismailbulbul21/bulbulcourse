import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { lessonSchema, type LessonInput } from "../../schemas/course.schema";
import { LessonService } from "../../services/lessons.service";
import { UploadService, type UploadHandle } from "../../services/upload.service";
import { StorageService } from "../../services/storage.service";
import Spinner from "../../components/Spinner";
import ErrorMessage from "../../components/ErrorMessage";

type UploadState =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "uploading"; pct: number }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string };

export default function LessonEditor() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const queryClient = useQueryClient();
  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaved, setFormSaved] = useState(false);
  const [resourceBusy, setResourceBusy] = useState(false);
  const uploadHandleRef = useRef<UploadHandle | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const resourceInputRef = useRef<HTMLInputElement>(null);

  const lessonQuery = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => LessonService.getById(lessonId!),
    enabled: Boolean(lessonId),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LessonInput>({
    resolver: zodResolver(lessonSchema),
    values: lessonQuery.data
      ? {
          title: lessonQuery.data.title,
          description: lessonQuery.data.description,
          is_preview: lessonQuery.data.is_preview,
        }
      : { title: "", description: "", is_preview: false },
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
    void queryClient.invalidateQueries({ queryKey: ["course-lessons", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["syllabus", courseId] });
  }

  if (lessonQuery.isPending) return <Spinner label="Loading lesson…" />;
  if (lessonQuery.isError) {
    return <ErrorMessage error={lessonQuery.error} onRetry={() => lessonQuery.refetch()} />;
  }

  const lesson = lessonQuery.data;

  async function saveForm(values: LessonInput) {
    setFormError(null);
    setFormSaved(false);
    try {
      await LessonService.update(lesson.id, values);
      invalidate();
      setFormSaved(true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save the lesson.");
    }
  }

  async function startUpload(file: File) {
    setUpload({ phase: "requesting" });
    try {
      // 1. Ask the edge function (admin-only) for a presigned PUT URL.
      const { upload_url, video_key } = await UploadService.requestUploadUrl(
        lesson.id,
        file.name,
        file.type || "video/mp4"
      );

      // 2. Upload the file straight to Contabo (browser → bucket, no server hop).
      setUpload({ phase: "uploading", pct: 0 });
      const handle = UploadService.uploadToUrl(upload_url, file, (pct) =>
        setUpload({ phase: "uploading", pct })
      );
      uploadHandleRef.current = handle;
      await handle.promise;

      // 3. Save the Contabo object path (video_key) on the lesson.
      setUpload({ phase: "saving" });
      const duration = await UploadService.getVideoDuration(file);
      await LessonService.update(lesson.id, {
        video_key,
        duration_seconds: duration,
      });
      invalidate();
      setUpload({ phase: "done" });
    } catch (e) {
      setUpload({
        phase: "error",
        message: e instanceof Error ? e.message : "Upload failed. Please try again.",
      });
    } finally {
      uploadHandleRef.current = null;
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  async function addResource(file: File) {
    setResourceBusy(true);
    try {
      const resource = await StorageService.uploadResource(courseId!, lesson.id, file);
      await LessonService.update(lesson.id, {
        resources: [...lesson.resources, resource],
      });
      invalidate();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Resource upload failed.");
    } finally {
      setResourceBusy(false);
      if (resourceInputRef.current) resourceInputRef.current.value = "";
    }
  }

  async function removeResource(url: string) {
    try {
      await LessonService.update(lesson.id, {
        resources: lesson.resources.filter((r) => r.url !== url),
      });
      invalidate();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not remove the resource.");
    }
  }

  const uploading = upload.phase === "requesting" || upload.phase === "uploading" || upload.phase === "saving";

  return (
    <div className="page page-narrow">
      <Link to={`/admin/courses/${courseId}?tab=curriculum`} className="muted">
        ← Back to curriculum
      </Link>
      <h1>Edit lesson</h1>

      <form className="card form-card" onSubmit={handleSubmit(saveForm)} noValidate>
        {formError && <div className="error-box">{formError}</div>}
        {formSaved && <div className="success-box">Lesson saved.</div>}

        <label>
          Lesson title
          <input type="text" {...register("title")} />
          {errors.title && <span className="field-error">{errors.title.message}</span>}
        </label>

        <label>
          Description
          <textarea rows={4} {...register("description")} />
        </label>

        <label className="checkbox-label">
          <input type="checkbox" {...register("is_preview")} />
          <span>
            ☑ Free Preview — anyone can watch this lesson without buying the course
          </span>
        </label>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save lesson"}
        </button>
      </form>

      <div className="card upload-card">
        <h3>Lesson video</h3>
        {lesson.video_key && upload.phase === "idle" && (
          <p className="success-box">
            ✓ Video uploaded{lesson.duration_seconds > 0 &&
              ` (${Math.round(lesson.duration_seconds / 60)} min)`}. Uploading a new
            file will replace it.
          </p>
        )}

        {upload.phase === "error" && <div className="error-box">{upload.message}</div>}
        {upload.phase === "done" && (
          <div className="success-box">✓ Upload complete. The lesson is ready.</div>
        )}

        {uploading ? (
          <div className="upload-progress">
            {upload.phase === "requesting" && <Spinner label="Preparing secure upload…" />}
            {upload.phase === "uploading" && (
              <>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${upload.pct}%` }} />
                </div>
                <p>
                  Uploading… {upload.pct}%
                  <button
                    type="button"
                    className="btn btn-danger btn-sm upload-cancel"
                    onClick={() => uploadHandleRef.current?.abort()}
                  >
                    Cancel
                  </button>
                </p>
                <p className="muted">Keep this page open until the upload finishes.</p>
              </>
            )}
            {upload.phase === "saving" && <Spinner label="Finalizing…" />}
          </div>
        ) : (
          <label className="upload-dropzone">
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void startUpload(file);
              }}
            />
            <span>+ Choose Video</span>
            <span className="muted">MP4 recommended. Uploads go straight to secure storage.</span>
          </label>
        )}
      </div>

      <div className="card">
        <h3>Resources (PDFs, files)</h3>
        {lesson.resources.length > 0 && (
          <ul className="resource-list">
            {lesson.resources.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  📄 {r.name}
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void removeResource(r.url)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={resourceInputRef}
          type="file"
          disabled={resourceBusy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void addResource(file);
          }}
        />
        {resourceBusy && <Spinner label="Uploading resource…" />}
      </div>
    </div>
  );
}
