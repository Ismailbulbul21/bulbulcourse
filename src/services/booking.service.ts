import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import { invokeFunction } from "../lib/functions";
import type {
  AdminBookingRow,
  AvailabilityRule,
  BlockedDate,
  BookingStats,
  BookingStatus,
  BookingWithType,
  PaymentChannel,
  SessionType,
  Slot,
} from "../types/db";

export type SessionTypeInput = Pick<
  SessionType,
  "title" | "description" | "duration_minutes" | "price" | "is_active" | "sort_order"
>;

export interface CreateBookingInput {
  session_type_id: string;
  starts_at: string;
  topic: string;
  payment_channel: PaymentChannel;
  phone_number: string;
}

export interface CreateBookingResult {
  booking_id: string;
  reference: string;
  message: string;
}

export const BookingService = {
  /** Students see active session types only (RLS); admins see all. */
  async sessionTypes(): Promise<SessionType[]> {
    const { data, error } = await supabase
      .from("session_types")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("duration_minutes", { ascending: true })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as SessionType[];
  },

  async sessionType(id: string): Promise<SessionType> {
    const { data, error } = await supabase
      .from("session_types")
      .select("*")
      .eq("id", id)
      .abortSignal(queryTimeoutSignal())
      .maybeSingle();
    if (error) throw toError(error);
    if (!data) throw new Error("Nooca ballantan lama helin.");
    return data as SessionType;
  },

  /** Open start times — calculated in the database, never who booked them. */
  async slots(sessionTypeId: string, days = 14): Promise<Slot[]> {
    const { data, error } = await supabase
      .rpc("get_available_slots", { p_session_type_id: sessionTypeId, p_days: days })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as Slot[];
  },

  async availability(): Promise<AvailabilityRule[]> {
    const { data, error } = await supabase
      .from("availability_rules")
      .select("*")
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as AvailabilityRule[];
  },

  /**
   * Hold the time and charge the wallet through the create-booking edge
   * function. Resolves once the phone prompt is approved; throws with the
   * provider's message otherwise (the hold stays so the student can retry).
   */
  createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
    return invokeFunction<CreateBookingResult>("create-booking", input);
  },

  /**
   * The current student's bookings. Explicitly filtered to the logged-in
   * user, because admin RLS can read every booking.
   */
  async myBookings(): Promise<BookingWithType[]> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
      .from("bookings")
      .select("*, session_types(title, duration_minutes)")
      .eq("user_id", session.user.id)
      .in("status", ["confirmed", "completed"])
      .order("starts_at", { ascending: true })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as unknown as BookingWithType[];
  },

  /** The student's still-valid hold on one exact time, if any. */
  async myHold(sessionTypeId: string, startsAt: string): Promise<BookingWithType | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabase
      .from("bookings")
      .select("*, session_types(title, duration_minutes)")
      .eq("user_id", session.user.id)
      .eq("session_type_id", sessionTypeId)
      .eq("starts_at", startsAt)
      .eq("status", "pending")
      .gt("hold_expires_at", new Date().toISOString())
      .abortSignal(queryTimeoutSignal())
      .maybeSingle();
    if (error) throw toError(error);
    return (data as unknown as BookingWithType | null) ?? null;
  },

  // ── Admin ──────────────────────────────────────────────────────────────

  async adminBookings(): Promise<AdminBookingRow[]> {
    const { data, error } = await supabase
      .from("bookings")
      .select("*, session_types(title, duration_minutes), profiles(full_name)")
      .neq("status", "expired")
      .order("starts_at", { ascending: false })
      .limit(300)
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as unknown as AdminBookingRow[];
  },

  async updateBooking(
    id: string,
    patch: Partial<{ status: BookingStatus; admin_note: string; meeting_url: string | null }>
  ): Promise<void> {
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error) throw toError(error);
  },

  async stats(): Promise<BookingStats | null> {
    const { data, error } = await supabase
      .rpc("get_booking_stats")
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data as BookingStats | null) ?? null;
  },

  async createSessionType(input: SessionTypeInput): Promise<void> {
    const { error } = await supabase.from("session_types").insert(input);
    if (error) throw toError(error);
  },

  async updateSessionType(id: string, patch: Partial<SessionTypeInput>): Promise<void> {
    const { error } = await supabase.from("session_types").update(patch).eq("id", id);
    if (error) throw toError(error);
  },

  async deleteSessionType(id: string): Promise<void> {
    const { error } = await supabase.from("session_types").delete().eq("id", id);
    if (error) {
      // Foreign key: a session type that has bookings can't be deleted.
      if ((error as { code?: string }).code === "23503") {
        throw new Error("Noocan ballamo ayaa ku xiran — dami (switch off) halkii aad tirtiri lahayd.");
      }
      throw toError(error);
    }
  },

  async addAvailability(rule: Pick<AvailabilityRule, "weekday" | "start_time" | "end_time">): Promise<void> {
    const { error } = await supabase.from("availability_rules").insert(rule);
    if (error) throw toError(error);
  },

  async deleteAvailability(id: string): Promise<void> {
    const { error } = await supabase.from("availability_rules").delete().eq("id", id);
    if (error) throw toError(error);
  },

  async blockedDates(): Promise<BlockedDate[]> {
    const { data, error } = await supabase
      .from("blocked_dates")
      .select("*")
      .gte("day", new Date().toISOString().slice(0, 10))
      .order("day", { ascending: true })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as BlockedDate[];
  },

  async addBlockedDate(day: string, reason: string): Promise<void> {
    const { error } = await supabase.from("blocked_dates").insert({ day, reason });
    if (error) throw toError(error);
  },

  async removeBlockedDate(day: string): Promise<void> {
    const { error } = await supabase.from("blocked_dates").delete().eq("day", day);
    if (error) throw toError(error);
  },
};
