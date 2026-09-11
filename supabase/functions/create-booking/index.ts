// create-booking — user JWT → check the requested time with the SAME
// database function the booking page uses → hold it (the bookings table's
// no-overlap rule makes double booking impossible) → WaafiPay API_PURCHASE
// → confirm, or keep the hold so the student can top up and try again.
//
// Course payments (create-payment) are deliberately untouched. The WaafiPay
// call, phone handling and decline messages mirror create-payment exactly.
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

/** Normalize a Somali mobile number to 252XXXXXXXXX (same as create-payment). */
function cleanPhone(input: string): string {
  let phone = String(input).replace(/\D/g, "");
  if (!phone.startsWith("252")) {
    if (phone.startsWith("0")) phone = "252" + phone.substring(1);
    else if (phone.length <= 9) phone = "252" + phone;
  }
  return phone;
}

/** How long a picked time is held before anyone else can take it. */
const HOLD_MINUTES = 10;
/** Keep the hold alive at least this long while the phone prompt is open. */
const PAYMENT_WINDOW_MINUTES = 5;
/** Retrying can extend a hold, but never beyond this from when it began. */
const MAX_HOLD_MINUTES = 30;

const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);

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
    const sessionTypeId = body?.session_type_id;
    const startsAtRaw = body?.starts_at;
    const paymentChannel = body?.payment_channel;
    const phoneNumber = body?.phone_number;
    const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 1000) : "";

    if (!sessionTypeId || !startsAtRaw || !paymentChannel || !phoneNumber) {
      return fail(
        400,
        "invalid_request",
        "session_type_id, starts_at, payment_channel and phone_number are required."
      );
    }
    if (!["EVC", "ZAAD", "SAHAL"].includes(paymentChannel)) {
      return fail(400, "invalid_channel", "Invalid payment channel. Use EVC, ZAAD or SAHAL.");
    }
    const startsAt = new Date(startsAtRaw);
    if (Number.isNaN(startsAt.getTime())) {
      return fail(400, "invalid_time", "Invalid time.");
    }

    // ── Booking switch: closed to students until the admin opens it ──
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin = profile?.role === "admin";
    if (!isAdmin) {
      const { data: bookingSwitch } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "booking_enabled")
        .maybeSingle();
      if (bookingSwitch?.value !== "true") {
        return fail(403, "booking_closed", "Ballamaha wali lama furin.");
      }
    }

    // ── Price and duration ALWAYS come from the database, never the client ──
    const { data: sessionType } = await admin
      .from("session_types")
      .select("id, title, duration_minutes, price, currency, is_active")
      .eq("id", sessionTypeId)
      .maybeSingle();
    if (!sessionType || !sessionType.is_active || sessionType.price === null) {
      return fail(404, "not_found", "Nooca ballantan lama heli karo.");
    }

    const endsAt = addMinutes(startsAt, sessionType.duration_minutes);
    const phone = cleanPhone(phoneNumber);
    const amount = Number(sessionType.price);

    // 1. Release everyone's lapsed holds so they stop blocking times.
    await admin
      .from("bookings")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("hold_expires_at", new Date().toISOString());

    // 2. Retrying after a failed payment? Reuse this student's hold on this time.
    const { data: existing } = await admin
      .from("bookings")
      .select("id, created_at, hold_expires_at")
      .eq("user_id", user.id)
      .eq("session_type_id", sessionType.id)
      .eq("status", "pending")
      .eq("starts_at", startsAt.toISOString())
      .limit(1)
      .maybeSingle();

    let bookingId: string;
    let createdAt: Date;
    let holdExpiresAt: Date;

    if (existing) {
      bookingId = existing.id;
      createdAt = new Date(existing.created_at);
      holdExpiresAt = new Date(existing.hold_expires_at);
    } else {
      // 3. The time must be one the booking page offers — same function.
      const { data: slots, error: slotsError } = await admin.rpc("booking_slots_internal", {
        p_session_type_id: sessionType.id,
        p_days: 60,
      });
      if (slotsError) {
        console.error("Slot check error:", slotsError);
        return fail(500, "db_error", "Could not check the time. Please try again.");
      }
      const offered = ((slots ?? []) as { slot_start: string }[]).some(
        (s) => new Date(s.slot_start).getTime() === startsAt.getTime()
      );
      if (!offered) {
        return fail(
          409,
          "slot_unavailable",
          "Waqtigan hadda lama heli karo. Fadlan dooro waqti kale."
        );
      }

      // 4. One hold per student: release any other time they were holding.
      await admin
        .from("bookings")
        .update({ status: "expired" })
        .eq("user_id", user.id)
        .eq("status", "pending");

      // 5. Hold it. The no-overlap rule rejects this if someone got there first.
      holdExpiresAt = addMinutes(new Date(), HOLD_MINUTES);
      const { data: held, error: holdError } = await admin
        .from("bookings")
        .insert({
          user_id: user.id,
          session_type_id: sessionType.id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: "pending",
          hold_expires_at: holdExpiresAt.toISOString(),
          topic,
          amount,
          currency: sessionType.currency ?? "USD",
          payment_channel: paymentChannel,
          phone_number: phone,
        })
        .select("id, created_at")
        .single();
      if (holdError || !held) {
        if (holdError?.code === "23P01") {
          return fail(
            409,
            "slot_taken",
            "Qof kale ayaa hadda qabsaday waqtigan. Fadlan dooro waqti kale."
          );
        }
        console.error("Hold insert error:", holdError);
        return fail(500, "db_error", "Could not hold the time. Please try again.");
      }
      bookingId = held.id;
      createdAt = new Date(held.created_at);
    }

    const { data: meetingSetting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "meeting_url")
      .maybeSingle();
    const meetingUrl = meetingSetting?.value?.trim() || null;

    // ── Free session: confirm immediately, no payment provider involved ──
    if (amount <= 0) {
      const { error: freeError } = await admin
        .from("bookings")
        .update({
          status: "confirmed",
          hold_expires_at: null,
          payment_channel: "FREE",
          payment_reference: `FREE-${Date.now()}`,
          phone_number: phone,
          topic,
          meeting_url: meetingUrl,
        })
        .eq("id", bookingId);
      if (freeError) {
        console.error("Free booking confirm error:", freeError);
        return fail(500, "db_error", "Could not confirm the booking. Please try again.");
      }
      return ok({
        booking_id: bookingId,
        reference: "FREE",
        message: "Ballantaada waa la xaqiijiyay.",
      });
    }

    // ── Paid session: WaafiPay credentials (same secrets as create-payment) ──
    const merchantUid =
      Deno.env.get("WAAFI_MERCHANT_UID") ?? Deno.env.get("WAAFIPAY_MERCHANT_UID");
    const apiUserId =
      Deno.env.get("WAAFI_API_USER_ID") ?? Deno.env.get("WAAFIPAY_API_USER_ID");
    const apiKey = Deno.env.get("WAAFI_API_KEY") ?? Deno.env.get("WAAFIPAY_API_KEY");
    if (!merchantUid || !apiUserId || !apiKey) {
      console.error("Missing WaafiPay credentials");
      return fail(500, "config_error", "Payments are not configured yet.");
    }

    // Keep the hold alive while the phone prompt is open, capped so that
    // repeated retries can never hold a time indefinitely.
    const extendedHold = new Date(
      Math.min(
        Math.max(
          holdExpiresAt.getTime(),
          addMinutes(new Date(), PAYMENT_WINDOW_MINUTES).getTime()
        ),
        addMinutes(createdAt, MAX_HOLD_MINUTES).getTime()
      )
    );
    await admin
      .from("bookings")
      .update({
        hold_expires_at: extendedHold.toISOString(),
        payment_channel: paymentChannel,
        phone_number: phone,
        topic,
      })
      .eq("id", bookingId);

    const referenceId = `BKG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

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
          currency: sessionType.currency ?? "USD",
          description: `BulbulCourses ballan: ${String(sessionType.title).slice(0, 70)}`,
        },
      },
    };

    console.log("Calling WaafiPay (booking):", { booking: bookingId, referenceId, amount });

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
      const transactionId = String(
        waafiResult?.params?.transactionId ??
          waafiResult?.params?.referenceId ??
          referenceId
      );

      // Record the payment first, so money is never lost track of even if
      // confirming the time fails below.
      await admin
        .from("bookings")
        .update({ payment_reference: transactionId })
        .eq("id", bookingId);

      const { error: confirmError } = await admin
        .from("bookings")
        .update({ status: "confirmed", hold_expires_at: null, meeting_url: meetingUrl })
        .eq("id", bookingId);

      if (confirmError) {
        console.error("CRITICAL: booking paid but not confirmed:", {
          bookingId,
          transactionId,
          confirmError,
        });
        return fail(
          500,
          "activation_failed",
          `Lacagta waa la bixiyay laakiin ballanta lama xaqiijin. La xiriir macallinka — tixraac: ${transactionId}`
        );
      }

      return ok({
        booking_id: bookingId,
        reference: transactionId,
        message: "Ballantaada waa la xaqiijiyay.",
      });
    }

    // Declined / cancelled / timed out on the phone. The hold stays in place
    // so the student can top up and press Pay again for the same time.
    const declineMsg =
      waafiResult?.params?.description ??
      waafiResult?.responseMsg ??
      "The payment was declined by the provider.";
    console.error("Booking payment declined:", declineMsg);
    return fail(402, "payment_declined", `Payment declined: ${declineMsg}`);
  } catch (e) {
    console.error("create-booking error:", e);
    return fail(500, "internal", "An unexpected error occurred. Please try again.");
  }
});
