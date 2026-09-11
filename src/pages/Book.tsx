import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { BookingService } from "../services/booking.service";
import { SettingsService, isOn } from "../services/settings.service";
import { useAuthStore } from "../stores/authStore";
import { formatPrice } from "../components/CourseCard";
import {
  SOMALI_WEEKDAYS,
  formatClock,
  formatSomaliaDay,
  formatSomaliaTime,
  somaliaDayKey,
} from "../lib/somaliaTime";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";
import type { Slot } from "../types/db";

export default function Book() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const [chosenTypeId, setChosenTypeId] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["app-settings", user?.id ?? "anon"],
    queryFn: () => SettingsService.all(),
  });
  const typesQuery = useQuery({
    queryKey: ["session-types"],
    queryFn: () => BookingService.sessionTypes(),
  });
  const hoursQuery = useQuery({
    queryKey: ["availability"],
    queryFn: () => BookingService.availability(),
  });

  // Only switched-on sessions are bookable — admins preview the same list.
  const types = (typesQuery.data ?? []).filter((t) => t.is_active && t.price !== null);
  const selected =
    types.find((t) => t.id === chosenTypeId) ?? (types.length === 1 ? types[0] : null);

  const slotsQuery = useQuery({
    queryKey: ["slots", selected?.id],
    queryFn: () => BookingService.slots(selected!.id, 14),
    enabled: Boolean(selected),
  });

  if (settingsQuery.isPending || typesQuery.isPending) return <Spinner label="Sugaya…" />;
  if (settingsQuery.isError) {
    return <ErrorMessage error={settingsQuery.error} onRetry={() => settingsQuery.refetch()} />;
  }
  if (typesQuery.isError) {
    return <ErrorMessage error={typesQuery.error} onRetry={() => typesQuery.refetch()} />;
  }

  const open = isOn(settingsQuery.data, "booking_enabled");

  if (!open && !isAdmin) {
    return (
      <div className="page page-narrow">
        <div className="card empty-state">
          <h3>Ballamaha wali lama furin</h3>
          <p>Dhawaan ayaa la furayaa. Soo laabo mar dambe.</p>
          <Link to="/" className="btn btn-primary">
            ← Ku laabo koorsooyinka
          </Link>
        </div>
      </div>
    );
  }

  // Group open times by their calendar day in Somalia.
  const slots = slotsQuery.data ?? [];
  const days = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = somaliaDayKey(slot.slot_start);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }

  // Weekly hours, one line per weekday (Saturday first, as the Somali week starts).
  const hoursByDay = new Map<number, string[]>();
  for (const rule of hoursQuery.data ?? []) {
    hoursByDay.set(rule.weekday, [
      ...(hoursByDay.get(rule.weekday) ?? []),
      `${formatClock(rule.start_time)} – ${formatClock(rule.end_time)}`,
    ]);
  }
  const weekOrder = [6, 0, 1, 2, 3, 4, 5];

  function pickSlot(slot: Slot) {
    if (!selected) return;
    const seconds = Math.floor(new Date(slot.slot_start).getTime() / 1000);
    // Session and time live in the PATH so they survive the signup redirect.
    const path = `/book/${selected.id}/${seconds}`;
    if (!user) {
      navigate("/signup", { state: { from: path } });
      return;
    }
    navigate(path);
  }

  return (
    <div className="page">
      {!open && isAdmin && (
        <div className="status-banner status-draft">
          <div>
            <strong>● Kaliya adiga ayaa arkaya boggan</strong>
            <p className="muted">
              Ballamuhu way xiran yihiin. Ka shid Admin → Bookings marka aad diyaar tahay.
            </p>
          </div>
          <Link to="/admin/bookings" className="btn btn-secondary">
            Admin →
          </Link>
        </div>
      )}

      <section className="book-hero">
        <p className="wizard-step">
          Ballan 1-on-1 <span className="bi-en">Book a session</span>
        </p>
        <h1>Si toos ah ila baro</h1>
        <p className="hire-lead">
          Su'aalahaaga, mashruucaaga, ama khaladka kugu dhegay — waqti gaar ah oo aniga
          iyo adiga oo keliya ah, Google Meet.
        </p>
      </section>

      <div className="book-layout">
        <div className="book-main">
          <section className="card">
            <h2 className="book-step">
              <span className="process-num" aria-hidden>
                1
              </span>
              Dooro nooca ballanta
            </h2>
            {types.length === 0 ? (
              <p className="muted">Wali ballan lama diyaarin. Soo laabo dhawaan.</p>
            ) : (
              <div className="type-grid">
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`type-card ${selected?.id === t.id ? "type-card-active" : ""}`}
                    onClick={() => setChosenTypeId(t.id)}
                    aria-pressed={selected?.id === t.id}
                  >
                    <span className="type-card-title">{t.title}</span>
                    <span className="type-card-meta">
                      ⏱️ {t.duration_minutes} daqiiqo · {formatPrice(t.price ?? 0, t.currency)}
                    </span>
                    {t.description && <span className="type-card-desc">{t.description}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          {selected && (
            <section className="card">
              <h2 className="book-step">
                <span className="process-num" aria-hidden>
                  2
                </span>
                Dooro waqti
              </h2>
              <p className="tz-note">🕐 Dhammaan waqtiyadu waa waqtiga Soomaaliya</p>

              {slotsQuery.isPending ? (
                <Spinner label="Raadinaya waqtiyada bannaan…" />
              ) : slotsQuery.isError ? (
                <ErrorMessage error={slotsQuery.error} onRetry={() => slotsQuery.refetch()} />
              ) : days.size === 0 ? (
                <p className="muted">
                  Laba toddobaad ee soo socda waqti bannaan ma jiro. Fadlan soo laabo dhawaan.
                </p>
              ) : (
                <div className="slot-days">
                  {[...days.entries()].map(([key, daySlots]) => (
                    <div key={key} className="slot-day">
                      <h3 className="slot-day-head">{formatSomaliaDay(daySlots[0].slot_start)}</h3>
                      <div className="slot-chips">
                        {daySlots.map((slot) => (
                          <button
                            key={slot.slot_start}
                            type="button"
                            className="chip"
                            onClick={() => pickSlot(slot)}
                          >
                            {formatSomaliaTime(slot.slot_start)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="book-side">
          <div className="card">
            <h3>Sida ay u shaqeyso</h3>
            <ol className="book-how">
              <li>Dooro nooca iyo waqtiga kuu habboon</li>
              <li>Ku bixi EVC Plus, ZAAD ama Sahal — waqtigu 10 daqiiqo ayuu kuu xiran yahay</li>
              <li>Waxaad helaysaa link-ga Google Meet iyo WhatsApp si aad ila soo xiriirto</li>
            </ol>
          </div>

          {hoursByDay.size > 0 && (
            <div className="card">
              <h3>Saacadaha aan shaqeeyo</h3>
              <ul className="hours-list">
                {weekOrder
                  .filter((d) => hoursByDay.has(d))
                  .map((d) => (
                    <li key={d}>
                      <span>{SOMALI_WEEKDAYS[d]}</span>
                      <span>{hoursByDay.get(d)!.join(", ")}</span>
                    </li>
                  ))}
              </ul>
              <p className="tz-note">Waqtiga Soomaaliya</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
