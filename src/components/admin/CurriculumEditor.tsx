import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ModuleService } from "../../services/modules.service";
import { LessonService } from "../../services/lessons.service";
import Spinner from "../Spinner";
import ErrorMessage from "../ErrorMessage";
import type { ModuleWithLessons } from "../../types/db";

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export default function CurriculumEditor({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["course-lessons", courseId];
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const modulesQuery = useQuery({
    queryKey,
    queryFn: () => ModuleService.listWithLessons(courseId),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["syllabus", courseId] });
  }

  const addModule = useMutation({
    mutationFn: (title: string) =>
      ModuleService.create(courseId, title, modulesQuery.data?.length ?? 0),
    onSuccess: () => {
      setNewModuleTitle("");
      invalidate();
    },
  });

  const renameModule = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      ModuleService.rename(id, title),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ModuleWithLessons[]>(queryKey);
      queryClient.setQueryData<ModuleWithLessons[]>(queryKey, (old) =>
        (old ?? []).map((m) => (m.id === id ? { ...m, title } : m))
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: invalidate,
  });

  const deleteModule = useMutation({
    mutationFn: (id: string) => ModuleService.remove(id),
    onSuccess: invalidate,
  });

  const reorderModules = useMutation({
    mutationFn: (orderedIds: string[]) => ModuleService.reorder(orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ModuleWithLessons[]>(queryKey);
      queryClient.setQueryData<ModuleWithLessons[]>(queryKey, (old) => {
        const byId = new Map((old ?? []).map((m) => [m.id, m]));
        return orderedIds
          .map((id) => byId.get(id))
          .filter((m): m is ModuleWithLessons => Boolean(m));
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: invalidate,
  });

  const addLesson = useMutation({
    mutationFn: ({ moduleId, title, sortOrder }: { moduleId: string; title: string; sortOrder: number }) =>
      LessonService.create(moduleId, courseId, title, sortOrder),
    onSuccess: invalidate,
  });

  const deleteLesson = useMutation({
    mutationFn: (id: string) => LessonService.remove(id),
    onSuccess: invalidate,
  });

  const reorderLessons = useMutation({
    mutationFn: ({ orderedIds }: { moduleId: string; orderedIds: string[] }) =>
      LessonService.reorder(orderedIds),
    onMutate: async ({ moduleId, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ModuleWithLessons[]>(queryKey);
      queryClient.setQueryData<ModuleWithLessons[]>(queryKey, (old) =>
        (old ?? []).map((m) => {
          if (m.id !== moduleId) return m;
          const byId = new Map(m.lessons.map((l) => [l.id, l]));
          return {
            ...m,
            lessons: orderedIds
              .map((id) => byId.get(id))
              .filter((l): l is ModuleWithLessons["lessons"][number] => Boolean(l)),
          };
        })
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: invalidate,
  });

  if (modulesQuery.isPending) return <Spinner label="Loading curriculum…" />;
  if (modulesQuery.isError) {
    return (
      <ErrorMessage error={modulesQuery.error} onRetry={() => modulesQuery.refetch()} />
    );
  }

  const modules = modulesQuery.data;
  const moduleIds = modules.map((m) => m.id);

  return (
    <div className="curriculum">
      {modules.length === 0 && (
        <p className="muted">Start by adding your first module (e.g. "Introduction").</p>
      )}

      {modules.map((mod, mi) => (
        <details key={mod.id} className="curriculum-module" open>
          <summary>
            <input
              type="text"
              className="inline-input"
              defaultValue={mod.title}
              onClick={(e) => e.preventDefault()}
              onBlur={(e) => {
                const title = e.target.value.trim();
                if (title && title !== mod.title) {
                  renameModule.mutate({ id: mod.id, title });
                }
              }}
              aria-label="Module title"
            />
            <span className="row-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={mi === 0}
                onClick={() => reorderModules.mutate(arrayMove(moduleIds, mi, mi - 1))}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={mi === modules.length - 1}
                onClick={() => reorderModules.mutate(arrayMove(moduleIds, mi, mi + 1))}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete module "${mod.title}" and all its lessons? This cannot be undone.`
                    )
                  ) {
                    deleteModule.mutate(mod.id);
                  }
                }}
              >
                Delete
              </button>
            </span>
          </summary>

          <ul className="curriculum-lessons">
            {mod.lessons.map((lesson, li) => {
              const lessonIds = mod.lessons.map((l) => l.id);
              return (
                <li key={lesson.id} className="curriculum-lesson">
                  <Link
                    to={`/admin/courses/${courseId}/lessons/${lesson.id}`}
                    className="curriculum-lesson-title"
                  >
                    {lesson.title}
                  </Link>
                  <span className="curriculum-lesson-badges">
                    {lesson.is_preview && <span className="badge badge-preview">Preview</span>}
                    <span className={`badge ${lesson.video_key ? "badge-published" : "badge-draft"}`}>
                      {lesson.video_key ? "✓ Video" : "No video"}
                    </span>
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={li === 0}
                      onClick={() =>
                        reorderLessons.mutate({
                          moduleId: mod.id,
                          orderedIds: arrayMove(lessonIds, li, li - 1),
                        })
                      }
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={li === mod.lessons.length - 1}
                      onClick={() =>
                        reorderLessons.mutate({
                          moduleId: mod.id,
                          orderedIds: arrayMove(lessonIds, li, li + 1),
                        })
                      }
                      title="Move down"
                    >
                      ↓
                    </button>
                    <Link
                      to={`/admin/courses/${courseId}/lessons/${lesson.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm(`Delete lesson "${lesson.title}"?`)) {
                          deleteLesson.mutate(lesson.id);
                        }
                      }}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              );
            })}
            <li className="curriculum-add">
              <AddInput
                placeholder="+ Add lesson (type a title and press Enter)"
                disabled={addLesson.isPending}
                onAdd={(title) =>
                  addLesson.mutate({
                    moduleId: mod.id,
                    title,
                    sortOrder: mod.lessons.length,
                  })
                }
              />
            </li>
          </ul>
        </details>
      ))}

      <div className="curriculum-add-module">
        <input
          type="text"
          placeholder="New module title (e.g. React Basics)"
          value={newModuleTitle}
          onChange={(e) => setNewModuleTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newModuleTitle.trim()) {
              e.preventDefault();
              addModule.mutate(newModuleTitle.trim());
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!newModuleTitle.trim() || addModule.isPending}
          onClick={() => addModule.mutate(newModuleTitle.trim())}
        >
          + Add Module
        </button>
      </div>
    </div>
  );
}

function AddInput({
  placeholder,
  disabled,
  onAdd,
}: {
  placeholder: string;
  disabled?: boolean;
  onAdd: (title: string) => void;
}) {
  const [value, setValue] = useState("");
  function submit() {
    const title = value.trim();
    if (!title) return;
    onAdd(title);
    setValue("");
  }
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }}
      onBlur={() => value.trim() && submit()}
    />
  );
}
