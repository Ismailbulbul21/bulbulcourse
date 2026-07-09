import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";

export interface AdminPerCourse {
  id: string;
  title: string;
  buyers: number;
  revenue: number;
}

export interface AdminStats {
  total_users: number;
  total_students: number;
  paid_purchases: number;
  total_revenue: number;
  published_courses: number;
  per_course: AdminPerCourse[];
}

export const AdminService = {
  /** Aggregate stats — admin only (the RPC returns null for everyone else). */
  async stats(): Promise<AdminStats | null> {
    const { data, error } = await supabase
      .rpc("get_admin_stats")
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data as AdminStats | null) ?? null;
  },
};
