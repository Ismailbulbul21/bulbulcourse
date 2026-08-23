export type Role = "student" | "admin";
export type CourseStatus = "draft" | "coming_soon" | "published" | "archived";
/** Recorded = video lessons. Live = scheduled classes + a WhatsApp group. */
export type CourseType = "recorded" | "live";
export type PurchaseStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded";
export type PaymentChannel = "EVC" | "ZAAD" | "SAHAL";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  /** Old price — when > price the UI shows a crossed-out discount. */
  compare_at_price: number | null;
  currency: string;
  thumbnail_url: string | null;
  status: CourseStatus;
  /** Existing courses default to "recorded" — they are unaffected by live courses. */
  course_type: CourseType;
  /** Live courses only: the overall run dates (per-class dates live in live_sessions). */
  live_starts_on: string | null;
  live_ends_on: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LessonResource {
  name: string;
  url: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  description: string;
  /** Contabo object path (e.g. videos/<course>/<lesson>/file.mp4) — never a URL. */
  video_key: string | null;
  duration_seconds: number;
  is_preview: boolean;
  sort_order: number;
  resources: LessonResource[];
  created_at: string;
  updated_at: string;
}

export interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

export interface Purchase {
  id: string;
  user_id: string;
  course_id: string;
  amount: number;
  currency: string;
  status: PurchaseStatus;
  payment_channel: PaymentChannel | null;
  payment_reference: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseWithCourse extends Purchase {
  courses: Course | null;
}

export interface Progress {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  last_position_seconds: number;
  completed: boolean;
  updated_at: string;
}

export interface CourseComment {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_is_admin: boolean;
}

/** Row returned by the get_course_syllabus RPC (no video_key — safe for anonymous). */
export interface SyllabusRow {
  module_id: string;
  module_title: string;
  module_sort: number;
  lesson_id: string | null;
  lesson_title: string | null;
  lesson_sort: number | null;
  duration_seconds: number | null;
  is_preview: boolean | null;
  has_video: boolean | null;
}

export interface SyllabusLesson {
  id: string;
  title: string;
  sort_order: number;
  duration_seconds: number;
  is_preview: boolean;
  has_video: boolean;
}

export interface SyllabusModule {
  id: string;
  title: string;
  sort_order: number;
  lessons: SyllabusLesson[];
}

/** One scheduled class of a live course. Public — sold before purchase. */
export interface LiveSession {
  id: string;
  course_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * The WhatsApp group link. Readable ONLY by someone with a completed
 * purchase of this course (or an admin) — enforced by RLS, not the UI.
 */
export interface LiveCourseAccess {
  course_id: string;
  whatsapp_group_url: string;
  created_at: string;
  updated_at: string;
}

/** A completed buyer of a course — admin view, for WhatsApp approval. */
export interface CourseBuyer {
  purchase_id: string;
  user_id: string;
  full_name: string;
  phone_number: string | null;
  amount: number;
  created_at: string;
}
