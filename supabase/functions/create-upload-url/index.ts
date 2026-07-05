// create-upload-url — admin JWT → presigned Contabo PUT URL.
// The browser uploads the video straight to Contabo with this URL and then
// saves lessons.video_key. Contabo secrets never leave this function.
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
      return fail(401, "unauthorized", "Authentication failed. Please log in again.");
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return fail(403, "forbidden", "Only admins can upload videos.");
    }

    const body = await req.json().catch(() => null);
    const lessonId = body?.lesson_id;
    const filename = body?.filename;
    if (!lessonId || !filename) {
      return fail(400, "invalid_request", "lesson_id and filename are required.");
    }

    const { data: lesson } = await admin
      .from("lessons")
      .select("id, course_id")
      .eq("id", lessonId)
      .maybeSingle();
    if (!lesson) return fail(404, "not_found", "Lesson not found. Save the lesson first.");

    const endpoint = Deno.env.get("CONTABO_ENDPOINT");
    const bucket = Deno.env.get("CONTABO_BUCKET");
    const accessKey = Deno.env.get("CONTABO_ACCESS_KEY");
    const secretKey = Deno.env.get("CONTABO_SECRET_KEY");
    if (!endpoint || !bucket || !accessKey || !secretKey) {
      console.error("Missing Contabo secrets:", {
        hasEndpoint: !!endpoint,
        hasBucket: !!bucket,
        hasAccessKey: !!accessKey,
        hasSecretKey: !!secretKey,
      });
      return fail(
        500,
        "config_error",
        "Video storage is not configured yet. Set the CONTABO_* secrets and try again."
      );
    }

    const safeName = String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-100);
    const videoKey = `videos/${lesson.course_id}/${lesson.id}/${Date.now()}-${safeName}`;

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      service: "s3",
      region: Deno.env.get("CONTABO_REGION") ?? "default",
    });

    const url = new URL(`${endpoint.replace(/\/+$/, "")}/${bucket}/${videoKey}`);
    url.searchParams.set("X-Amz-Expires", "3600");
    const signed = await aws.sign(new Request(url.toString(), { method: "PUT" }), {
      aws: { signQuery: true },
    });

    console.log("Presigned upload created:", { user: user.id, videoKey });
    return ok({ upload_url: signed.url, video_key: videoKey });
  } catch (e) {
    console.error("create-upload-url error:", e);
    return fail(500, "internal", "An unexpected error occurred. Please try again.");
  }
});
