import { useQuery } from "@tanstack/react-query";
import { BookingService } from "../services/booking.service";
import { SettingsService } from "../services/settings.service";
import { useAuthStore } from "../stores/authStore";
import { formatSomaliaRange } from "../lib/somaliaTime";
import { whatsappLink } from "../lib/whatsapp";
import ErrorMessage from "./ErrorMessage";

/**
 * The student's 1-on-1 sessions, shown in My Learning. Renders nothing for
 * students who have never booked, so the course dashboard stays unchanged.
 */
export default function MyBookings() {
  const { user } = useAuthStore();

  const bookingsQuery = useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: () => BookingService.myBookings(),
    enabled: Boolean(user),
  });
  const settingsQuery = useQuery({
    queryKey: ["app-settings", user?.id ?? "anon"],
    queryFn: () => SettingsService.all(),
  });

  if (bookingsQuery.isError) {
    return <ErrorMessage error={bookingsQuery.error} onRetry={() => bookingsQuery.refetch()} />;
  }
  const bookings = bookingsQuery.data ?? [];
  if (bookings.length === 0) return null;

  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.ends_at).getTime() > now
  );
  const past = bookings
    .filter((b) => !upcoming.includes(b))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  return (
    <section className="my-bookings">
      <h2>
        Ballamahaaga <span className="bi-en">My sessions</span>
      </h2>

      {upcoming.length === 0 ? (
        <p className="muted">Ballan soo socota ma jirto.</p>
      ) : (
        <div className="booking-list">
          {upcoming.map((b) => {
            const title = b.session_types?.title ?? "Ballan";
            const when = formatSomaliaRange(b.starts_at, b.ends_at);
            const waLink = whatsappLink(
              settingsQuery.data?.whatsapp_number,
              `Asalaamu calaykum, ballantayda: ${title} — ${when} (waqtiga Soomaaliya).`
            );
            return (
              <div key={b.id} className="card booking-item">
                <div className="booking-item-main">
                  <span className="badge badge-published">✓ La xaqiijiyay</span>
                  <h3>{title}</h3>
                  <p className="booking-item-when">
                    {when} <span className="tz-note">· Waqtiga Soomaaliya</span>
                  </p>
                  {b.topic && <p className="muted">“{b.topic}”</p>}
                </div>
                <div className="booking-item-actions">
                  {b.meeting_url ? (
                    <a
                      className="btn btn-primary"
                      href={b.meeting_url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      🎥 Ku biir Google Meet
                    </a>
                  ) : (
                    <span className="muted">Link-ga waxaa lagugu soo diri doonaa WhatsApp.</span>
                  )}
                  {waLink && (
                    <a className="btn btn-whatsapp" href={waLink} target="_blank" rel="noreferrer noopener">
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <details className="booking-past">
          <summary>Ballamihii hore ({past.length})</summary>
          <ul>
            {past.map((b) => (
              <li key={b.id}>
                <span>{b.session_types?.title ?? "Ballan"}</span>
                <span className="muted">{formatSomaliaRange(b.starts_at, b.ends_at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
