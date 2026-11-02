import { supabase, queryTimeoutSignal, toError } from "../lib/supabase";

export const WHATSAPP_INVITE = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/;

export const WhatsAppService = {
  /** The group invite link. Row-level security returns it only to buyers and admins. */
  async linkFor(courseId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("course_whatsapp")
      .select("url")
      .eq("course_id", courseId)
      .abortSignal(queryTimeoutSignal())
      .maybeSingle();
    if (error) throw toError(error);
    return (data?.url as string | undefined) ?? null;
  },

  /** Links for several courses at once (My Learning). */
  async linksFor(courseIds: string[]): Promise<Record<string, string>> {
    if (courseIds.length === 0) return {};
    const { data, error } = await supabase
      .from("course_whatsapp")
      .select("course_id, url")
      .in("course_id", courseIds)
      .abortSignal(queryTimeoutSignal());
    if (error) throw toError(error);
    return Object.fromEntries((data ?? []).map((r) => [r.course_id as string, r.url as string]));
  },

  async save(courseId: string, url: string | null): Promise<void> {
    if (!url) {
      const { error } = await supabase.from("course_whatsapp").delete().eq("course_id", courseId);
      if (error) throw toError(error);
      return;
    }
    const { error } = await supabase
      .from("course_whatsapp")
      .upsert({ course_id: courseId, url }, { onConflict: "course_id" });
    if (error) throw toError(error);
  },
};
