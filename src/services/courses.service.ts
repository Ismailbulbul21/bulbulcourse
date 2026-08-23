import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type { Course, CourseType, SyllabusModule, SyllabusRow } from "../types/db";

export const PAGE_SIZE = 9;

export interface CourseListParams {
  page: number;
  search?: string;
  category?: string;
}

export interface CourseListResult {
  courses: Course[];
  total: number;
  pageCount: number;
}

function groupSyllabus(rows: SyllabusRow[]): SyllabusModule[] {
  const modules = new Map<string, SyllabusModule>();
  for (const row of rows) {
    let mod = modules.get(row.module_id);
    if (!mod) {
      mod = {
        id: row.module_id,
        title: row.module_title,
        sort_order: row.module_sort,
        lessons: [],
      };
      modules.set(row.module_id, mod);
    }
    if (row.lesson_id) {
      mod.lessons.push({
        id: row.lesson_id,
        title: row.lesson_title ?? "",
        sort_order: row.lesson_sort ?? 0,
        duration_seconds: row.duration_seconds ?? 0,
        is_preview: Boolean(row.is_preview),
        has_video: Boolean(row.has_video),
      });
    }
  }
  return Array.from(modules.values()).sort((a, b) => a.sort_order - b.sort_order);
}

export const CourseService = {
  /** Public catalog: published courses with search + category + pagination. */
  async list({ page, search, category }: CourseListParams): Promise<CourseListResult> {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("courses")
      .select("*", { count: "exact" })
      .in("status", ["published", "coming_soon"])
      .is("deleted_at", null)
      // 'published' sorts after 'coming_soon' alphabetically, so descending
      // puts buyable courses first and upcoming ones after.
      .order("status", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to)
      .abortSignal(queryTimeoutSignal());

    if (search && search.trim()) {
      const q = search.trim().replace(/[%_,()]/g, " ");
      query = query.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`
      );
    }
    if (category && category !== "All") {
      query = query.eq("category", category);
    }

    const { data, error, count } = await query;
    if (error) throw toError(error);
    const total = count ?? 0;
    return {
      courses: (data ?? []) as Course[],
      total,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  },

  async getById(id: string): Promise<Course> {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .abortSignal(queryTimeoutSignal())
      .maybeSingle();
    if (error) throw toError(error);
    if (!data) throw new Error("Course not found.");
    return data as Course;
  },

  async categories(): Promise<string[]> {
    const { data, error } = await supabase
      .from("courses")
      .select("category")
      .eq("status", "published")
      .is("deleted_at", null)
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    const set = new Set((data ?? []).map((r) => r.category as string));
    return Array.from(set).sort();
  },

  /** Safe syllabus for the course detail page — works for anonymous users. */
  async syllabus(courseId: string): Promise<SyllabusModule[]> {
    const { data, error } = await supabase
      .rpc("get_course_syllabus", { p_course_id: courseId })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return groupSyllabus((data ?? []) as SyllabusRow[]);
  },

  // ── Admin ──────────────────────────────────────────────────────────────

  async adminList(): Promise<Course[]> {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as Course[];
  },

  async create(input: {
    title: string;
    description: string;
    category: string;
    price: number;
    compare_at_price: number | null;
    created_by: string;
    course_type?: CourseType;
    live_starts_on?: string | null;
    live_ends_on?: string | null;
  }): Promise<Course> {
    const { data, error } = await supabase
      .from("courses")
      .insert(input)
      .select()
      .single();
    if (error) throw toError(error);
    return data as Course;
  },

  async update(id: string, patch: Partial<Course>): Promise<Course> {
    const { data, error } = await supabase
      .from("courses")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw toError(error);
    return data as Course;
  },

  /** Soft delete — the row is kept with deleted_at set. */
  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from("courses")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", id);
    if (error) throw toError(error);
  },
};
