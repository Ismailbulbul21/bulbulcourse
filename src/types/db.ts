export type Role = "student" | "admin";
export type CourseStatus = "draft" | "coming_soon" | "published" | "archived";
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

// ── Hire me ────────────────────────────────────────────────────────────

/** Key/value site settings. Public keys are readable by everyone. */
export interface AppSetting {
  key: string;
  value: string;
  is_public: boolean;
  updated_at: string;
}

export type ServiceCategory = "mobile" | "web" | "system" | "other";

export interface ServicePackage {
  id: string;
  category: ServiceCategory;
  title: string;
  description: string;
  /** null = "ask for a price". */
  price_from: number | null;
  currency: string;
  delivery_time: string;
  features: string[];
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory;
  image_url: string | null;
  project_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type InquiryStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export interface ProjectInquiry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  project_type: ServiceCategory;
  package_id: string | null;
  budget: string;
  message: string;
  status: InquiryStatus;
  admin_note: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Booking ────────────────────────────────────────────────────────────

export interface SessionType {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  /** Must be set before the session can be switched on. */
  price: number | null;
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Weekly teaching hours in Somalia time. weekday 0 = Sunday (Axad). */
export interface AvailabilityRule {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface BlockedDate {
  day: string;
  reason: string;
  created_at: string;
}

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "expired";

export interface Booking {
  id: string;
  user_id: string;
  session_type_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  hold_expires_at: string | null;
  topic: string;
  amount: number;
  currency: string;
  payment_channel: PaymentChannel | "FREE" | null;
  payment_reference: string | null;
  phone_number: string | null;
  meeting_url: string | null;
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export interface BookingWithType extends Booking {
  session_types: Pick<SessionType, "title" | "duration_minutes"> | null;
}

export interface AdminBookingRow extends BookingWithType {
  profiles: { full_name: string } | null;
}

/** One open start time, from the get_available_slots RPC. */
export interface Slot {
  slot_start: string;
  slot_end: string;
}

export interface BookingStats {
  upcoming: number;
  completed: number;
  paid: number;
  revenue: number;
  new_requests: number;
}
