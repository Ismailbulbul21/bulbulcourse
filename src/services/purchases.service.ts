import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type { PurchaseWithCourse } from "../types/db";

export const PurchaseService = {
  /**
   * Completed purchases of the current user, with course details.
   * Explicitly filtered to the logged-in user: admin RLS can read EVERY
   * purchase, so without this filter the admin's My Learning would show one
   * card per customer. Also deduped to one card per course.
   */
  async myPurchases(): Promise<PurchaseWithCourse[]> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
      .from("purchases")
      .select("*, courses(*)")
      .eq("user_id", session.user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    const seen = new Set<string>();
    return ((data ?? []) as unknown as PurchaseWithCourse[]).filter((p) => {
      if (!p.courses || seen.has(p.course_id)) return false;
      seen.add(p.course_id);
      return true;
    });
  },

  async hasPurchased(courseId: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc("has_purchased", { p_course_id: courseId })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return Boolean(data);
  },
};
