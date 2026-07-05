import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type { Progress } from "../types/db";

async function currentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

export const ProgressService = {
  /** All progress rows of the current user (RLS-scoped). */
  async mine(): Promise<Progress[]> {
    const { data, error } = await supabase
      .from("progress")
      .select("*")
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as Progress[];
  },

  async forCourse(courseId: string): Promise<Progress[]> {
    const { data, error } = await supabase
      .from("progress")
      .select("*")
      .eq("course_id", courseId)
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as Progress[];
  },

  /**
   * Save the playback position. `completed` is intentionally NOT written here
   * so a rewatch never un-completes a lesson (upsert only updates the columns
   * provided).
   */
  async savePosition(
    lessonId: string,
    courseId: string,
    positionSeconds: number
  ): Promise<void> {
    const userId = await currentUserId();
    if (!userId) return;
    const { error } = await supabase.from("progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        course_id: courseId,
        last_position_seconds: Math.max(0, Math.floor(positionSeconds)),
      },
      { onConflict: "user_id,lesson_id" }
    );
    if (error) throw toError(error);
  },

  async markCompleted(
    lessonId: string,
    courseId: string,
    positionSeconds: number
  ): Promise<void> {
    const userId = await currentUserId();
    if (!userId) return;
    const { error } = await supabase.from("progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        course_id: courseId,
        last_position_seconds: Math.max(0, Math.floor(positionSeconds)),
        completed: true,
      },
      { onConflict: "user_id,lesson_id" }
    );
    if (error) throw toError(error);
  },
};
