// create-upload-url — admin JWT → presigned Contabo upload.
// Small files get a single presigned PUT. Larger files get an S3 multipart
// upload: the function initiates it server-side and returns presigned URLs
// for every part (uploaded in parallel by the browser — much faster over
// long-distance links) plus presigned complete/abort URLs.
// Contabo secrets never leave this function.
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

const PART_SIZE = 16 * 1024 * 1024; // 16MB parts
const MULTIPART_THRESHOLD = 24 * 1024 * 1024; // multipart above 24MB
const MAX_PARTS = 1000; // ~15GB ceiling
const URL_TTL = "21600"; // 6h — big uploads on slow links need time

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
    const size = Number(body?.size ?? 0);
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
    const objectBase = `${endpoint.replace(/\/+$/, "")}/${bucket}/${videoKey}`;

    async function presign(method: string, params: Record<string, string>) {
      const u = new URL(objectBase);
      for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
      u.searchParams.set("X-Amz-Expires", URL_TTL);
      const signed = await aws.sign(new Request(u.toString(), { method }), {
        aws: { signQuery: true },
      });
      return signed.url;
    }

    // ── Small file: single presigned PUT ──────────────────────────────
    if (!size || size <= MULTIPART_THRESHOLD) {
      const uploadUrl = await presign("PUT", {});
      console.log("Presigned single upload:", { user: user.id, videoKey, size });
      return ok({ mode: "single", upload_url: uploadUrl, video_key: videoKey });
    }

    // ── Large file: multipart with parallel parts ─────────────────────
    const partCount = Math.ceil(size / PART_SIZE);
    if (partCount > MAX_PARTS) {
      return fail(400, "too_large", "Video is too large. Please compress it first.");
    }

    const initRes = await aws.fetch(`${objectBase}?uploads`, { method: "POST" });
    const initXml = await initRes.text();
    const uploadId = (initXml.match(/<UploadId>([^<]+)<\/UploadId>/) || [])[1];
    if (!initRes.ok || !uploadId) {
      console.error("Multipart initiate failed:", initRes.status, initXml.slice(0, 300));
      return fail(500, "storage_error", "Could not start the upload. Please try again.");
    }

    const partUrls: string[] = [];
    for (let n = 1; n <= partCount; n++) {
      partUrls.push(
        await presign("PUT", { partNumber: String(n), uploadId })
      );
    }
    const completeUrl = await presign("POST", { uploadId });
    const abortUrl = await presign("DELETE", { uploadId });

    console.log("Presigned multipart upload:", {
      user: user.id,
      videoKey,
      size,
      parts: partCount,
    });
    return ok({
      mode: "multipart",
      video_key: videoKey,
      part_size: PART_SIZE,
      part_urls: partUrls,
      complete_url: completeUrl,
      abort_url: abortUrl,
    });
  } catch (e) {
    console.error("create-upload-url error:", e);
    return fail(500, "internal", "An unexpected error occurred. Please try again.");
  }
});
