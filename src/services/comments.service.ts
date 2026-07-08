import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type { CourseComment } from "../types/db";

export const CommentService = {
  /** Comments for a course, with author name + admin flag (buyers/admin only). */
  async list(courseId: string): Promise<CourseComment[]> {
    const { data, error } = await supabase
      .rpc("get_course_comments", { p_course_id: courseId })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as CourseComment[];
  },

  /** Post a comment or a reply (parentId set). RLS enforces buyer/admin. */
  async add(courseId: string, body: string, parentId?: string): Promise<void> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Please log in again.");
    const { error } = await supabase.from("comments").insert({
      course_id: courseId,
      user_id: session.user.id,
      parent_id: parentId ?? null,
      body: body.trim(),
    });
    if (error) throw toError(error);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) throw toError(error);
  },
};
