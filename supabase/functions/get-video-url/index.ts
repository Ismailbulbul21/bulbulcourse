// get-video-url — user JWT → entitlement check (purchase / preview / admin)
// → short-lived presigned Contabo GET URL for playback.
// The signed URL expires after 1 hour, so shared links die quickly.
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function ok<T>(data: T): Response {
  return json(200, { success: true, data, error: null });
}
function fail(status: number, code: string, message: string): Response {
  return json(status, { success: false, data: null, error: { code, message } });
}

const URL_TTL_SECONDS = 3600;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Method not allowed");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail(401, "unauthorized", "Missing authorization header");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(jwt);
    if (userError || !user) {
      return fail(401, "unauthorized", "Please log in to watch lessons.");
    }

    const body = await req.json().catch(() => null);
    const lessonId = body?.lesson_id;
    if (!lessonId) return fail(400, "invalid_request", "lesson_id is required.");

    const { data: lesson } = await admin
      .from("lessons")
      .select("id, course_id, video_key, is_preview, courses(status, deleted_at)")
      .eq("id", lessonId)
      .maybeSingle();
    if (!lesson) return fail(404, "not_found", "Lesson not found.");
    if (!lesson.video_key) {
      return fail(404, "no_video", "This lesson has no video yet.");
    }

    const course = lesson.courses as unknown as {
      status: string;
      deleted_at: string | null;
    } | null;
    const published = course?.status === "published" && !course?.deleted_at;

    // Entitlement: admin OR (published AND preview) OR (published AND purchased)
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin = profile?.role === "admin";

    let allowed = isAdmin || (published && lesson.is_preview === true);
    if (!allowed && published) {
      const { data: purchase } = await admin
        .from("purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", lesson.course_id)
        .eq("status", "completed")
        .limit(1)
        .maybeSingle();
      allowed = Boolean(purchase);
    }

    if (!allowed) {
      return fail(403, "forbidden", "Purchase this course to watch this lesson.");
    }

    // ── One active device per account (admins exempt) ──────────────────
    // The newest device to open the app claims the slot (user_devices row);
    // playback URLs are only signed for that device.
    if (!isAdmin) {
      const deviceId = typeof body?.device_id === "string" ? body.device_id : "";
      if (!deviceId) {
        return fail(403, "device_required", "Please refresh the page and try again.");
      }
      const { data: device } = await admin
        .from("user_devices")
        .select("device_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!device) {
        await admin.from("user_devices").upsert(
          {
            user_id: user.id,
            device_id: deviceId,
            user_agent: req.headers.get("user-agent") ?? "",
          },
          { onConflict: "user_id" }
        );
      } else if (device.device_id !== deviceId) {
        return fail(
          403,
          "device_conflict",
          "Your account is active on another device. Videos play on one device at a time — refresh this page to make this your active device."
        );
      }
    }

    const endpoint = Deno.env.get("CONTABO_ENDPOINT");
    const bucket = Deno.env.get("CONTABO_BUCKET");
    const accessKey = Deno.env.get("CONTABO_ACCESS_KEY");
    const secretKey = Deno.env.get("CONTABO_SECRET_KEY");
    if (!endpoint || !bucket || !accessKey || !secretKey) {
      return fail(
        500,
        "config_error",
        "Video storage is not configured yet. Set the CONTABO_* secrets and try again."
      );
    }

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      service: "s3",
      region: Deno.env.get("CONTABO_REGION") ?? "default",
    });

    const url = new URL(
      `${endpoint.replace(/\/+$/, "")}/${bucket}/${lesson.video_key}`
    );
    url.searchParams.set("X-Amz-Expires", String(URL_TTL_SECONDS));
    const signed = await aws.sign(new Request(url.toString(), { method: "GET" }), {
      aws: { signQuery: true },
    });

    return ok({ url: signed.url, expires_in: URL_TTL_SECONDS });
  } catch (e) {
    console.error("get-video-url error:", e);
    return fail(500, "internal", "An unexpected error occurred. Please try again.");
  }
});
