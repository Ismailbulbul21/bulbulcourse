// create-payment — user JWT → create pending purchase → WaafiPay API_PURCHASE
// (direct EVC Plus / ZAAD / Sahal mobile-money charge via USSD push; WaafiPay
// routes by MSISDN) → mark purchase completed/failed SERVER-SIDE. The client
// can never fake a payment.
import { createClient } from "npm:@supabase/supabase-js@2";

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

/** Normalize a Somali mobile number to 252XXXXXXXXX. */
function cleanPhone(input: string): string {
  let phone = String(input).replace(/\D/g, "");
  if (!phone.startsWith("252")) {
    if (phone.startsWith("0")) phone = "252" + phone.substring(1);
    else if (phone.length <= 9) phone = "252" + phone;
  }
  return phone;
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

    const body = await req.json().catch(() => null);
    const courseId = body?.course_id;
    const paymentChannel = body?.payment_channel;
    const phoneNumber = body?.phone_number;

    if (!courseId || !paymentChannel || !phoneNumber) {
      return fail(
        400,
        "invalid_request",
        "course_id, payment_channel and phone_number are required."
      );
    }
    if (!["EVC", "ZAAD", "SAHAL"].includes(paymentChannel)) {
      return fail(
        400,
        "invalid_channel",
        "Invalid payment channel. Use EVC, ZAAD or SAHAL."
      );
    }

    // Price ALWAYS comes from the database, never from the client.
    const { data: course } = await admin
      .from("courses")
      .select("id, title, price, currency, status, deleted_at")
      .eq("id", courseId)
      .maybeSingle();
    if (!course || course.status !== "published" || course.deleted_at) {
      return fail(404, "not_found", "This course is not available for purchase.");
    }

    const { data: existing } = await admin
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (existing) {
      return fail(409, "already_purchased", "You already own this course.");
    }

    const amount = Number(course.price);
    const phone = cleanPhone(phoneNumber);

    // ── Free course: enroll instantly, no payment provider involved ──
    if (amount <= 0) {
      const { data: freePurchase, error: freeError } = await admin
        .from("purchases")
        .insert({
          user_id: user.id,
          course_id: courseId,
          amount: 0,
          currency: course.currency ?? "USD",
          status: "completed",
          payment_channel: paymentChannel,
          payment_reference: `FREE-${Date.now()}`,
          phone_number: phone,
        })
        .select("id, payment_reference")
        .single();
      if (freeError) {
        console.error("Free enroll insert error:", freeError);
        return fail(500, "db_error", "Could not enroll you. Please try again.");
      }
      return ok({
        purchase_id: freePurchase.id,
        reference: freePurchase.payment_reference,
        message: "Enrolled for free. Happy learning!",
      });
    }

    // ── Paid course: WaafiPay credentials (support both naming conventions) ──
    const merchantUid =
      Deno.env.get("WAAFI_MERCHANT_UID") ?? Deno.env.get("WAAFIPAY_MERCHANT_UID");
    const apiUserId =
      Deno.env.get("WAAFI_API_USER_ID") ?? Deno.env.get("WAAFIPAY_API_USER_ID");
    const apiKey = Deno.env.get("WAAFI_API_KEY") ?? Deno.env.get("WAAFIPAY_API_KEY");

    if (!merchantUid || !apiUserId || !apiKey) {
      console.error("Missing WaafiPay credentials:", {
        hasMerchantUid: !!merchantUid,
        hasApiUserId: !!apiUserId,
        hasApiKey: !!apiKey,
      });
      return fail(
        500,
        "config_error",
        "Payments are not configured yet. Set the WAAFI_* secrets and try again."
      );
    }

    // 1. Create the pending purchase (server-side only — clients have no
    //    insert policy on purchases).
    const { data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .insert({
        user_id: user.id,
        course_id: courseId,
        amount,
        currency: course.currency ?? "USD",
        status: "pending",
        payment_channel: paymentChannel,
        phone_number: phone,
      })
      .select("id")
      .single();
    if (purchaseError || !purchase) {
      console.error("Purchase insert error:", purchaseError);
      return fail(500, "db_error", "Could not start the payment. Please try again.");
    }

    const referenceId = `CRS-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 2. Charge the wallet: API_PURCHASE = direct charge with USSD push
    //    (HPP_PURCHASE is for hosted payment pages and needs hppKey — wrong here).
    const waafiPayload = {
      schemaVersion: "1.0",
      requestId: referenceId,
      timestamp: new Date().toISOString(),
      channelName: "WEB",
      serviceName: "API_PURCHASE",
      serviceParams: {
        merchantUid,
        apiUserId,
        apiKey,
        paymentMethod: "MWALLET_ACCOUNT",
        payerInfo: {
          accountNo: phone,
          accountType: "MSISDN",
        },
        transactionInfo: {
          referenceId,
          invoiceId: referenceId,
          amount,
          currency: course.currency ?? "USD",
          description: `BulbulCourses: ${String(course.title).slice(0, 80)}`,
        },
      },
    };

    console.log("Calling WaafiPay:", { purchase: purchase.id, referenceId, amount });

    const waafiResponse = await fetch("https://api.waafipay.net/asm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(waafiPayload),
    });
    const waafiResult = await waafiResponse.json().catch(() => null);
    console.log("WaafiPay response:", JSON.stringify(waafiResult));

    const state = waafiResult?.params?.state;
    const isSuccess = state === "APPROVED" || waafiResult?.responseCode === "2001";

    if (isSuccess) {
      const transactionId =
        waafiResult?.params?.transactionId ??
        waafiResult?.params?.referenceId ??
        referenceId;

      const { error: updateError } = await admin
        .from("purchases")
        .update({ status: "completed", payment_reference: String(transactionId) })
        .eq("id", purchase.id);

      if (updateError) {
        console.error("CRITICAL: paid but purchase update failed:", updateError);
        return fail(
          500,
          "activation_failed",
          `Payment succeeded but unlocking failed. Contact support with reference: ${transactionId}`
        );
      }

      return ok({
        purchase_id: purchase.id,
        reference: String(transactionId),
        message: "Payment successful! The course is now unlocked.",
      });
    }

    // Payment declined / cancelled / timed out on the phone.
    const declineMsg =
      waafiResult?.params?.description ??
      waafiResult?.responseMsg ??
      "The payment was declined by the provider.";

    await admin
      .from("purchases")
      .update({ status: "failed", payment_reference: referenceId })
      .eq("id", purchase.id);

    console.error("Payment declined:", declineMsg);
    return fail(402, "payment_declined", `Payment declined: ${declineMsg}`);
  } catch (e) {
    console.error("create-payment error:", e);
    return fail(500, "internal", "An unexpected error occurred. Please try again.");
  }
});
