import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { BookingService, type CreateBookingResult } from "../services/booking.service";
import { SettingsService } from "../services/settings.service";
import { useAuthStore } from "../stores/authStore";
import { formatPrice } from "../components/CourseCard";
import { PAYMENT_CHANNELS } from "../schemas/course.schema";
import { bookingCheckoutSchema, type BookingCheckoutInput } from "../schemas/hire.schema";
import { formatSomaliaRange, formatSomaliaTime } from "../lib/somaliaTime";
import { whatsappLink } from "../lib/whatsapp";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";

export default function BookingCheckout() {
  const { typeId, slot } = useParams<{ typeId: string; slot: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [holdUntil, setHoldUntil] = useState<string | null>(null);
  const [result, setResult] = useState<CreateBookingResult | null>(null);

  // The chosen time travels in the URL path as unix seconds.
  const seconds = Number(slot);
  const startsAt =
    Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;

  const typeQuery = useQuery({
    queryKey: ["session-type", typeId],
    queryFn: () => BookingService.sessionType(typeId!),
    enabled: Boolean(typeId),
  });
  const settingsQuery = useQuery({
    queryKey: ["app-settings", user?.id ?? "anon"],
    queryFn: () => SettingsService.all(),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BookingCheckoutInput>({
    resolver: zodResolver(bookingCheckoutSchema),
    defaultValues: { payment_channel: "EVC", phone_number: "", topic: "" },
  });

  const selectedChannel = watch("payment_channel");
  const activeChannel =
    PAYMENT_CHANNELS.find((c) => c.value === selectedChannel) ?? PAYMENT_CHANNELS[0];

  if (!startsAt) {
    return (
      <div className="page page-narrow">
        <div className="card empty-state">
          <h3>Link-gan sax ma aha</h3>
          <Link to="/book" className="btn btn-primary">
            ← Dooro waqti
          </Link>
        </div>
      </div>
    );
  }

  if (typeQuery.isPending) return <Spinner label="Sugaya…" />;
  if (typeQuery.isError) {
    return <ErrorMessage error={typeQuery.error} onRetry={() => typeQuery.refetch()} />;
  }

  const sessionType = typeQuery.data;
  const endsAt = new Date(
    new Date(startsAt).getTime() + sessionType.duration_minutes * 60_000
  ).toISOString();
  const price = Number(sessionType.price ?? 0);
  const isFree = price <= 0;
  const when = formatSomaliaRange(startsAt, endsAt);

  async function onSubmit(values: BookingCheckoutInput) {
    setPayError(null);
    setHoldUntil(null);
    setPaying(true);
    try {
      const res = await BookingService.createBooking({
        session_type_id: sessionType.id,
        starts_at: startsAt!,
        topic: values.topic,
        payment_channel: values.payment_channel,
        phone_number: values.phone_number,
      });
      setResult(res);
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["slots", sessionType.id] });
    } catch (e) {
      setPayError(
        e instanceof Error ? e.message : "Lacag bixintu waa fashilantay. Fadlan mar kale isku day."
      );
      // If the time is still held for them, say until when — they can top up
      // and press Pay again without losing it.
      try {
        const hold = await BookingService.myHold(sessionType.id, startsAt!);
        setHoldUntil(hold?.hold_expires_at ?? null);
      } catch {
        // The payment error above already tells them what happened.
      }
    } finally {
      setPaying(false);
    }
  }

  if (result) {
    const waLink = whatsappLink(
      settingsQuery.data?.whatsapp_number,
      `Asalaamu calaykum, waxaan qabsaday ballan: ${sessionType.title} — ${when} (waqtiga Soomaaliya).`
    );
    return (
      <div className="page page-narrow">
        <div className="card booking-done">
          <div className="booking-done-icon" aria-hidden>
            ✓
          </div>
          <h1>Ballantaada waa la xaqiijiyay</h1>
          <p className="booking-when">
            {sessionType.title}
            <br />
            <strong>{when}</strong>
          </p>
          <p className="tz-note">Waqtiga Soomaaliya</p>
          <p className="muted">
            Link-ga Google Meet wuxuu ku jiraa bogga <strong>My Learning</strong>. Fadlan
            5 daqiiqo ka hor soo gal.
          </p>
          <div className="booking-done-actions">
            <Link to="/dashboard" className="btn btn-primary">
              Fiiri ballamahaaga
            </Link>
            {waLink && (
              <a className="btn btn-whatsapp" href={waLink} target="_blank" rel="noreferrer noopener">
                <span aria-hidden>💬</span> WhatsApp igu soo qor
              </a>
            )}
          </div>
          {result.reference !== "FREE" && (
            <p className="muted booking-ref">Tixraac: {result.reference}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <h1>Xaqiiji ballanta</h1>

      <div className="card checkout-summary">
        <div>
          <h3>{sessionType.title}</h3>
          <p className="muted booking-summary-when">
            {when}
            <br />
            <span className="tz-note">Waqtiga Soomaaliya · {sessionType.duration_minutes} daqiiqo</span>
          </p>
        </div>
        <div className="checkout-price-block">
          <span className="checkout-price-label">Lacagta</span>
          <div className="checkout-price">{formatPrice(price, sessionType.currency)}</div>
        </div>
      </div>

      {paying ? (
        <div className="card checkout-waiting">
          <Spinner label="La sugayo xaqiijinta lacag bixinta…" />
          <p>
            <strong>Fiiri taleefankaaga.</strong> Ansixi codsiga lacag bixinta si ballantaada
            loo xaqiijiyo. Fadlan bogga ha ka bixin.
          </p>
        </div>
      ) : (
        <form className="card form-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          {payError && (
            <div className="error-box">
              {payError}
              {holdUntil && (
                <p className="hold-note">
                  Waqtigan weli waa laguu hayaa ilaa <strong>{formatSomaliaTime(holdUntil)}</strong>.
                  Haddii haraagaagu yar yahay, lacag ku shubo kadibna mar kale taabo Bixi.
                </p>
              )}
            </div>
          )}

          <label>
            Maxaad rabtaa inaan kaa caawiyo? <span className="bi-en">What do you need help with?</span>
            <textarea
              rows={3}
              placeholder="tusaale: React app-kayga login-ka ma shaqeynayo"
              {...register("topic")}
            />
            {errors.topic && <span className="field-error">{errors.topic.message}</span>}
          </label>

          {!isFree && (
            <>
              <fieldset className="channel-picker">
                <legend>Ku bixi</legend>
                <div className="channel-options">
                  {PAYMENT_CHANNELS.map((c) => (
                    <label key={c.value} className="radio-card">
                      <input type="radio" value={c.value} {...register("payment_channel")} />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
                {errors.payment_channel && (
                  <span className="field-error">{errors.payment_channel.message}</span>
                )}
              </fieldset>

              <label>
                Lambarka {activeChannel.label}
                <input
                  type="tel"
                  placeholder={`tusaale: ${activeChannel.placeholder}`}
                  autoComplete="tel"
                  {...register("phone_number")}
                />
                {errors.phone_number && (
                  <span className="field-error">{errors.phone_number.message}</span>
                )}
              </label>
            </>
          )}

          {isFree && <input type="hidden" value="000000000" {...register("phone_number")} />}

          <button type="submit" className="btn btn-primary btn-block btn-lg">
            {isFree ? "Xaqiiji ballanta" : `Bixi ${formatPrice(price, sessionType.currency)}`}
          </button>
          <p className="muted">
            Marka aad taabato Bixi, waqtigan 10 daqiiqo ayaa laguu hayaa inta lacag bixintu
            socoto.
          </p>
        </form>
      )}

      <p className="muted">
        <Link to="/book">← Dooro waqti kale</Link>
      </p>
    </div>
  );
}
