import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type { Lesson, LessonResource } from "../types/db";

export const LessonService = {
  async getById(id: string): Promise<Lesson> {
    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", id)
      .abortSignal(queryTimeoutSignal())
      .maybeSingle();
    if (error) throw toError(error);
    if (!data) throw new Error("Lesson not found.");
    return data as Lesson;
  },

  async create(
    moduleId: string,
    courseId: string,
    title: string,
    sortOrder: number
  ): Promise<Lesson> {
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        module_id: moduleId,
        course_id: courseId,
        title,
        sort_order: sortOrder,
      })
      .select()
      .single();
    if (error) throw toError(error);
    return data as Lesson;
  },

  async update(
    id: string,
    patch: Partial<
      Pick<
        Lesson,
        | "title"
        | "description"
        | "is_preview"
        | "video_key"
        | "duration_seconds"
        | "sort_order"
      >
    > & { resources?: LessonResource[] }
  ): Promise<Lesson> {
    const { data, error } = await supabase
      .from("lessons")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw toError(error);
    return data as Lesson;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) throw toError(error);
  },

  /** Persist a full ordering within a module (index = sort_order). */
  async reorder(orderedIds: string[]): Promise<void> {
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from("lessons").update({ sort_order: index }).eq("id", id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw toError(failed.error);
  },

  /** Lesson counts per course (used by the dashboard). */
  async countByCourse(courseIds: string[]): Promise<Record<string, number>> {
    if (courseIds.length === 0) return {};
    const { data, error } = await supabase
      .from("lessons")
      .select("course_id")
      .in("course_id", courseIds)
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = row.course_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  },
};
