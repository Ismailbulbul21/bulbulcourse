import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";
import type { CourseBuyer, LiveSession } from "../types/db";

export interface LiveSessionInput {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
}

export const LiveService = {
  /**
   * Class schedule for a live course. Public by design — students need to
   * see the dates and topics before they buy. Contains nothing secret.
   */
  async sessions(courseId: string): Promise<LiveSession[]> {
    const { data, error } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("course_id", courseId)
      .order("starts_at", { ascending: true })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return (data ?? []) as LiveSession[];
  },

  /**
   * The WhatsApp group link. RLS returns nothing unless the caller has a
   * completed purchase of THIS course (or is an admin), so a missing row
   * and "not entitled" look identical from here — which is correct.
   */
  async whatsappUrl(courseId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("live_course_access")
      .select("whatsapp_group_url")
      .eq("course_id", courseId)
      .abortSignal(queryTimeoutSignal())
      .maybeSingle();
    if (error) throw toError(error);
    const url = (data?.whatsapp_group_url ?? "").trim();
    return url === "" ? null : url;
  },

  // ── Admin ──────────────────────────────────────────────────────────────

  async createSession(courseId: string, input: LiveSessionInput): Promise<LiveSession> {
    const { data, error } = await supabase
      .from("live_sessions")
      .insert({ course_id: courseId, ...input })
      .select()
      .single();
    if (error) throw toError(error);
    return data as LiveSession;
  },

  async updateSession(id: string, patch: Partial<LiveSessionInput>): Promise<LiveSession> {
    const { data, error } = await supabase
      .from("live_sessions")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw toError(error);
    return data as LiveSession;
  },

  async deleteSession(id: string): Promise<void> {
    const { error } = await supabase.from("live_sessions").delete().eq("id", id);
    if (error) throw toError(error);
  },

  /** Upsert the group link. Admin-only via RLS. */
  async saveWhatsappUrl(courseId: string, url: string): Promise<void> {
    const { error } = await supabase
      .from("live_course_access")
      .upsert(
        { course_id: courseId, whatsapp_group_url: url.trim() },
        { onConflict: "course_id" }
      );
    if (error) throw toError(error);
  },

  /**
   * Everyone who actually paid for this course, with the phone number they
   * paid from — so the admin can match WhatsApp join requests against real
   * buyers. Admin-only: the purchases RLS policy already restricts this.
   */
  async buyers(courseId: string): Promise<CourseBuyer[]> {
    const { data, error } = await supabase
      .from("purchases")
      .select("id, user_id, phone_number, amount, created_at, profiles(full_name)")
      .eq("course_id", courseId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      user_id: string;
      phone_number: string | null;
      amount: number;
      created_at: string;
      profiles: { full_name: string } | null;
    }>;

    // One row per student, newest first (a user could in theory have more
    // than one completed row for a course after a manual fix).
    const seen = new Set<string>();
    return rows
      .filter((r) => (seen.has(r.user_id) ? false : (seen.add(r.user_id), true)))
      .map((r) => ({
        purchase_id: r.id,
        user_id: r.user_id,
        full_name: r.profiles?.full_name?.trim() || "(no name)",
        phone_number: r.phone_number,
        amount: Number(r.amount),
        created_at: r.created_at,
      }));
  },
};

/** "9 Sep 2026 · 7:00 PM" — one class, in the reader's local time. */
export function formatSessionWhen(session: LiveSession): string {
  const start = new Date(session.starts_at);
  const date = start.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const from = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!session.ends_at) return `${date} · ${from}`;
  const to = new Date(session.ends_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${from} – ${to}`;
}

/** "1 Sep – 14 Sep 2026" for the course card and purchase panel. */
export function formatRunDates(
  startsOn: string | null,
  endsOn: string | null
): string | null {
  if (!startsOn && !endsOn) return null;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  // Dates are stored as plain YYYY-MM-DD; parse as local to avoid a
  // timezone shift moving the date by one day.
  const toLocal = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, day ?? 1);
  };
  if (startsOn && endsOn) {
    const a = toLocal(startsOn);
    const b = toLocal(endsOn);
    return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, {
      ...opts,
      year: "numeric",
    })}`;
  }
  const only = toLocal((startsOn ?? endsOn)!);
  return only.toLocaleDateString(undefined, { ...opts, year: "numeric" });
}

/** A class is "past" once its end time (or start, if no end) has gone by. */
export function isSessionPast(session: LiveSession): boolean {
  const end = session.ends_at ? new Date(session.ends_at) : new Date(session.starts_at);
  return end.getTime() < Date.now();
}
