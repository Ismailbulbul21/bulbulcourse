import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type { PurchaseWithCourse } from "../types/db";

export const PurchaseService = {
  /** Completed purchases of the current user, with course details (RLS-scoped). */
  async myPurchases(): Promise<PurchaseWithCourse[]> {
    const { data, error } = await supabase
      .from("purchases")
      .select("*, courses(*)")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as unknown as PurchaseWithCourse[];
  },

  async hasPurchased(courseId: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc("has_purchased", { p_course_id: courseId })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return Boolean(data);
  },
};
