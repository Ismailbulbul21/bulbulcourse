import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type { Module, ModuleWithLessons } from "../types/db";

export const ModuleService = {
  /**
   * Modules with their lessons. RLS decides which lesson rows come back:
   * admins see everything, buyers see all lessons of a published course,
   * everyone else only sees preview lessons.
   */
  async listWithLessons(courseId: string): Promise<ModuleWithLessons[]> {
    const { data, error } = await supabase
      .from("modules")
      .select("*, lessons(*)")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .order("sort_order", { referencedTable: "lessons", ascending: true })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as ModuleWithLessons[];
  },

  async create(courseId: string, title: string, sortOrder: number): Promise<Module> {
    const { data, error } = await supabase
      .from("modules")
      .insert({ course_id: courseId, title, sort_order: sortOrder })
      .select()
      .single();
    if (error) throw toError(error);
    return data as Module;
  },

  async rename(id: string, title: string): Promise<void> {
    const { error } = await supabase.from("modules").update({ title }).eq("id", id);
    if (error) throw toError(error);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) throw toError(error);
  },

  /** Persist a full ordering (index = sort_order). */
  async reorder(orderedIds: string[]): Promise<void> {
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from("modules").update({ sort_order: index }).eq("id", id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw toError(failed.error);
  },
};
