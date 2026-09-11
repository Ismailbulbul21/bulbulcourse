import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import AdminNav from "../../components/admin/AdminNav";
import Spinner from "../../components/Spinner";
import ErrorMessage from "../../components/ErrorMessage";
import { formatPrice } from "../../components/CourseCard";
import { BookingService, type SessionTypeInput } from "../../services/booking.service";
import { SettingsService, isOn, type Settings } from "../../services/settings.service";
import {
  SOMALI_WEEKDAYS,
  formatClock,
  formatSomaliaRange,
  formatSomaliaTime,
} from "../../lib/somaliaTime";
import { whatsappLink } from "../../lib/whatsapp";
import { useAuthStore } from "../../stores/authStore";
import type { AdminBookingRow, BookingStatus, SessionType } from "../../types/db";

type Tab = "bookings" | "sessions" | "hours" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "bookings", label: "Ballamaha" },
  { id: "sessions", label: "Noocyada" },
  { id: "hours", label: "Saacadaha" },
  { id: "settings", label: "Google Meet" },
];

/** Somali week order: Saturday first. */
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
const DURATIONS = [15, 30, 45, 60, 90, 120];

const STATUS_BADGE: Record<BookingStatus, [string, string]> = {
  pending: ["badge-draft", "⏳ Sugaya lacag"],
  confirmed: ["badge-published", "✓ La xaqiijiyay"],
  completed: ["badge-category", "Dhammaatay"],
  cancelled: ["badge-archived", "La joojiyay"],
  expired: ["badge-draft", "Dhacay"],
};

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export default function AdminBookings() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : "bookings";
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["app-settings", user?.id ?? "anon"],
    queryFn: () => SettingsService.all(),
  });
  const statsQuery = useQuery({
    queryKey: ["booking-stats"],
    queryFn: () => BookingService.stats(),
  });
  const toggle = useMutation({
    mutationFn: (on: boolean) => SettingsService.set("booking_enabled", on ? "true" : "false"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });

  const open = isOn(settingsQuery.data, "booking_enabled");
  const stats = statsQuery.data;

  return (
    <div className="page">
      <AdminNav />
      <div className="admin-hero">
        <div>
          <p className="wizard-step">Creator Studio</p>
          <h1>Bookings</h1>
        </div>
        <a href="/book" target="_blank" rel="noreferrer" className="btn btn-secondary">
          Fiiri bogga ↗
        </a>
      </div>

      <div className="stat-row stat-row-primary">
        <div className="stat-card stat-card-hero">
          <span className="stat-num">{statsQuery.isPending ? "…" : stats?.upcoming ?? 0}</span>
          <span className="stat-label">📅 Soo socda (upcoming)</span>
        </div>
        <div className="stat-card stat-card-hero">
          <span className="stat-num">{statsQuery.isPending ? "…" : stats?.completed ?? 0}</span>
          <span className="stat-label">✅ La dhammeeyay (done)</span>
        </div>
        <div className="stat-card stat-card-hero">
          <span className="stat-num">
            {statsQuery.isPending ? "…" : formatPrice(stats?.revenue ?? 0, "USD")}
          </span>
          <span className="stat-label">💰 Dakhliga ballamaha</span>
        </div>
      </div>

      <div className={`status-banner ${open ? "status-live" : "status-draft"}`}>
        <div>
          <strong>{open ? "✓ Ballamaha waa furan yihiin" : "● Ballamaha waa xiran yihiin"}</strong>
          <p className="muted">
            {open
              ? "Ardaydu way arki karaan waqtiyadaada, way bixin karaan, wayna qabsan karaan."
              : "Arday kale ma arko. Ku dar nooc (qiime leh), saacadaha, iyo link-ga Meet — kadibna fur."}
          </p>
        </div>
        <button
          type="button"
          className={`btn ${open ? "btn-secondary" : "btn-primary"}`}
          disabled={toggle.isPending || settingsQuery.isPending}
          onClick={() => {
            if (!open || window.confirm("Xir ballamaha? Ardaydu ma qabsan karaan waqti cusub.")) {
              toggle.mutate(!open);
            }
          }}
        >
          {open ? "Xir" : "🚀 Fur ballamaha"}
        </button>
      </div>
      {toggle.isError && <ErrorMessage error={toggle.error} />}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bookings" && <BookingsTab />}
      {tab === "sessions" && <SessionsTab />}
      {tab === "hours" && <HoursTab />}
      {tab === "settings" && <MeetTab settings={settingsQuery.data} />}
    </div>
  );
}

// ── Bookings ─────────────────────────────────────────────────────────────

function BookingsTab() {
  const queryClient = useQueryClient();
  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => BookingService.adminBookings(),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{ status: BookingStatus; admin_note: string; meeting_url: string | null }>;
    }) => BookingService.updateBooking(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-stats"] });
    },
  });

  if (bookingsQuery.isPending) return <Spinner label="Loading bookings…" />;
  if (bookingsQuery.isError) {
    return <ErrorMessage error={bookingsQuery.error} onRetry={() => bookingsQuery.refetch()} />;
  }

  const now = Date.now();
  const rows = bookingsQuery.data;
  const upcoming = rows
    .filter(
      (b) =>
        (b.status === "confirmed" || b.status === "pending") &&
        new Date(b.ends_at).getTime() > now
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = rows.filter((b) => !upcoming.includes(b));

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <h3>Wali ballan ma jirto</h3>
        <p>Marka arday qabsado oo bixiyo, halkan ayay ka muuqan doontaa.</p>
      </div>
    );
  }

  const renderRow = (b: AdminBookingRow) => (
    <BookingRow key={b.id} booking={b} onUpdate={(patch) => update.mutate({ id: b.id, patch })} />
  );

  return (
    <div>
      {update.isError && <ErrorMessage error={update.error} />}
      <h2 className="admin-list-title">Soo socda ({upcoming.length})</h2>
      {upcoming.length === 0 ? (
        <p className="muted">Ballan soo socota ma jirto.</p>
      ) : (
        <div className="admin-list">{upcoming.map(renderRow)}</div>
      )}
      {past.length > 0 && (
        <>
          <h2 className="admin-list-title">Hore ({past.length})</h2>
          <div className="admin-list">{past.map(renderRow)}</div>
        </>
      )}
    </div>
  );
}

function BookingRow({
  booking: b,
  onUpdate,
}: {
  booking: AdminBookingRow;
  onUpdate: (patch: Partial<{ status: BookingStatus; admin_note: string; meeting_url: string | null }>) => void;
}) {
  const [note, setNote] = useState(b.admin_note);
  const [meet, setMeet] = useState(b.meeting_url ?? "");
  const title = b.session_types?.title ?? "Ballan";
  const name = b.profiles?.full_name?.trim() || "(magac la'aan)";
  const when = formatSomaliaRange(b.starts_at, b.ends_at);
  const [badgeClass, badgeText] = STATUS_BADGE[b.status];
  const waLink = b.phone_number
    ? whatsappLink(
        b.phone_number,
        `Asalaamu calaykum ${name}, ballantaada: ${title} — ${when} (waqtiga Soomaaliya).` +
          (b.meeting_url ? ` Link-ga: ${b.meeting_url}` : "")
      )
    : null;

  return (
    <div className="card admin-item">
      <div className="admin-item-head">
        <div>
          <h3>{name}</h3>
          <p className="admin-item-meta">
            <strong>{when}</strong> · {title} ·{" "}
            {Number(b.amount) > 0 ? formatPrice(Number(b.amount), b.currency) : "Bilaash"}
            {b.payment_channel && ` · ${b.payment_channel}`}
          </p>
        </div>
        <span className={`badge ${badgeClass}`}>{badgeText}</span>
      </div>

      {b.topic && <p className="admin-item-message">“{b.topic}”</p>}
      {b.status === "pending" && b.hold_expires_at && (
        <p className="muted">
          Waqtiga waa loo hayaa ilaa {formatSomaliaTime(b.hold_expires_at)} — wali ma bixin.
        </p>
      )}

      <div className="admin-item-actions">
        {b.phone_number && (
          <a className="btn btn-secondary btn-sm" href={`tel:+${b.phone_number}`}>
            📞 {b.phone_number}
          </a>
        )}
        {waLink && (
          <a className="btn btn-whatsapp btn-sm" href={waLink} target="_blank" rel="noreferrer noopener">
            💬 WhatsApp
          </a>
        )}
        {b.status === "confirmed" && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onUpdate({ status: "completed" })}
          >
            ✓ Dhammaatay
          </button>
        )}
        {(b.status === "confirmed" || b.status === "pending") && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (
                window.confirm(
                  "Jooji ballantan? Waqtigu wuu furmayaa. Haddii uu bixiyay, lacag celinta gacanta ayaad ku samaynaysaa."
                )
              ) {
                onUpdate({ status: "cancelled" });
              }
            }}
          >
            Jooji
          </button>
        )}
      </div>

      <details className="admin-more">
        <summary>Faahfaahin</summary>
        {b.payment_reference && (
          <p className="muted">Tixraaca lacagta: {b.payment_reference}</p>
        )}
        <label>
          Link-ga Meet (ballantan kaliya)
          <input
            type="url"
            value={meet}
            placeholder="https://meet.google.com/…"
            onChange={(e) => setMeet(e.target.value)}
            onBlur={() =>
              meet.trim() !== (b.meeting_url ?? "") &&
              onUpdate({ meeting_url: meet.trim() === "" ? null : meet.trim() })
            }
          />
        </label>
        <label>
          Qoraal gaar ah (adiga kaliya)
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== b.admin_note && onUpdate({ admin_note: note })}
          />
        </label>
      </details>
    </div>
  );
}

// ── Session types ────────────────────────────────────────────────────────

interface SessionDraft {
  id: string | null;
  title: string;
  description: string;
  duration_minutes: string;
  price: string;
  is_active: boolean;
  sort_order: string;
}

const emptySession: SessionDraft = {
  id: null,
  title: "",
  description: "",
  duration_minutes: "60",
  price: "",
  is_active: false,
  sort_order: "0",
};

function fromSessionDraft(d: SessionDraft): SessionTypeInput {
  if (d.title.trim().length < 2) throw new Error("Geli magaca ballanta.");
  const price = d.price.trim();
  if (price !== "" && !(Number(price) >= 0)) throw new Error("Qiimaha sax ma aha.");
  if (d.is_active && price === "") {
    throw new Error("Geli qiimaha ka hor intaadan shidin.");
  }
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    duration_minutes: Number(d.duration_minutes),
    price: price === "" ? null : Number(price),
    is_active: d.is_active,
    sort_order: Number(d.sort_order) || 0,
  };
}

function SessionsTab() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const typesQuery = useQuery({
    queryKey: ["session-types"],
    queryFn: () => BookingService.sessionTypes(),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["session-types"] });
    void queryClient.invalidateQueries({ queryKey: ["slots"] });
  };

  const save = useMutation({
    mutationFn: async (d: SessionDraft) => {
      const input = fromSessionDraft(d);
      if (d.id) await BookingService.updateSessionType(d.id, input);
      else await BookingService.createSessionType(input);
    },
    onSuccess: () => {
      setDraft(null);
      setFormError(null);
      refresh();
    },
    onError: (e) => setFormError(errText(e, "Lama keydin.")),
  });
  const quick = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      BookingService.updateSessionType(id, { is_active }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => BookingService.deleteSessionType(id),
    onSuccess: refresh,
  });

  if (typesQuery.isPending) return <Spinner label="Loading…" />;
  if (typesQuery.isError) {
    return <ErrorMessage error={typesQuery.error} onRetry={() => typesQuery.refetch()} />;
  }

  const set = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const toDraft = (t: SessionType): SessionDraft => ({
    id: t.id,
    title: t.title,
    description: t.description,
    duration_minutes: String(t.duration_minutes),
    price: t.price === null ? "" : String(t.price),
    is_active: t.is_active,
    sort_order: String(t.sort_order),
  });

  return (
    <div>
      <div className="admin-subhead">
        <p className="muted">
          Waxa ardaydu qabsan karaan — magac, muddo iyo qiime. Nooc aan qiime lahayn lama
          shidi karo.
        </p>
        {!draft && (
          <button type="button" className="btn btn-primary" onClick={() => setDraft(emptySession)}>
            + Nooc cusub
          </button>
        )}
      </div>

      {draft && (
        <div className="card admin-form">
          <h3>{draft.id ? "Wax ka beddel nooca" : "Nooc cusub"}</h3>
          {formError && <div className="error-box">{formError}</div>}
          <label>
            Magaca
            <input
              type="text"
              value={draft.title}
              placeholder="tusaale: Caawimaad React ah — 60 daqiiqo"
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <label>
            Sharaxaad gaaban
            <input
              type="text"
              value={draft.description}
              placeholder="tusaale: Su'aalahaaga, code review, ama khalad kugu dhegay"
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <div className="form-row">
            <label>
              Muddada
              <select
                value={draft.duration_minutes}
                onChange={(e) => set("duration_minutes", e.target.value)}
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} daqiiqo
                  </option>
                ))}
              </select>
            </label>
            <label>
              Qiimaha (USD)
              <input
                type="number"
                min="0"
                step="1"
                value={draft.price}
                placeholder="tusaale: 20"
                onChange={(e) => set("price", e.target.value)}
              />
            </label>
          </div>
          <div className="check-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
              />
              Shidan (ardayda u muuqda)
            </label>
            <label className="checkbox-label">
              Kala horreynta
              <input
                type="number"
                className="sort-input"
                value={draft.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={save.isPending}
              onClick={() => save.mutate(draft)}
            >
              {save.isPending ? "Keydinaya…" : "Keydi"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraft(null);
                setFormError(null);
              }}
            >
              Jooji
            </button>
          </div>
        </div>
      )}

      {(quick.isError || remove.isError) && <ErrorMessage error={quick.error ?? remove.error} />}

      {typesQuery.data.length === 0 ? (
        !draft && (
          <div className="empty-state">
            <h3>Wali nooc ma jiro</h3>
            <p>Ku dar noocaaga ugu horreeya — tusaale 30 daqiiqo iyo 60 daqiiqo.</p>
          </div>
        )
      ) : (
        <div className="admin-list">
          {typesQuery.data.map((t) => (
            <div key={t.id} className="card admin-item">
              <div className="admin-item-head">
                <div>
                  <h3>{t.title}</h3>
                  <p className="admin-item-meta">
                    {t.duration_minutes} daqiiqo ·{" "}
                    {t.price === null ? "Qiime lama gelin" : formatPrice(t.price, t.currency)}
                  </p>
                </div>
                <span className={`badge ${t.is_active ? "badge-published" : "badge-draft"}`}>
                  {t.is_active ? "Shidan" : "Dansan"}
                </span>
              </div>
              <div className="admin-item-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={quick.isPending || (!t.is_active && t.price === null)}
                  title={!t.is_active && t.price === null ? "Marka hore qiime geli" : undefined}
                  onClick={() => quick.mutate({ id: t.id, is_active: !t.is_active })}
                >
                  {t.is_active ? "Dami" : "Shid"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setFormError(null);
                    setDraft(toDraft(t));
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (window.confirm(`Tirtir "${t.title}"?`)) remove.mutate(t.id);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Weekly hours + days off ──────────────────────────────────────────────

function HoursTab() {
  const queryClient = useQueryClient();
  const [weekday, setWeekday] = useState("6");
  const [start, setStart] = useState("16:00");
  const [end, setEnd] = useState("20:00");
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const rulesQuery = useQuery({
    queryKey: ["availability"],
    queryFn: () => BookingService.availability(),
  });
  const blockedQuery = useQuery({
    queryKey: ["blocked-dates"],
    queryFn: () => BookingService.blockedDates(),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["availability"] });
    void queryClient.invalidateQueries({ queryKey: ["blocked-dates"] });
    void queryClient.invalidateQueries({ queryKey: ["slots"] });
  };

  const addRule = useMutation({
    mutationFn: async () => {
      if (!start || !end || end <= start) {
        throw new Error("Saacadda dhammaadka waa inay ka danbeysaa bilowga.");
      }
      await BookingService.addAvailability({
        weekday: Number(weekday),
        start_time: start,
        end_time: end,
      });
    },
    onSuccess: () => {
      setFormError(null);
      refresh();
    },
    onError: (e) => setFormError(errText(e, "Lama darin.")),
  });
  const removeRule = useMutation({
    mutationFn: (id: string) => BookingService.deleteAvailability(id),
    onSuccess: refresh,
  });
  const addBlocked = useMutation({
    mutationFn: async () => {
      if (!day) throw new Error("Dooro taariikh.");
      await BookingService.addBlockedDate(day, reason.trim());
    },
    onSuccess: () => {
      setDay("");
      setReason("");
      setFormError(null);
      refresh();
    },
    onError: (e) => setFormError(errText(e, "Lama darin.")),
  });
  const removeBlocked = useMutation({
    mutationFn: (d: string) => BookingService.removeBlockedDate(d),
    onSuccess: refresh,
  });

  if (rulesQuery.isPending || blockedQuery.isPending) return <Spinner label="Loading…" />;
  if (rulesQuery.isError) {
    return <ErrorMessage error={rulesQuery.error} onRetry={() => rulesQuery.refetch()} />;
  }
  if (blockedQuery.isError) {
    return <ErrorMessage error={blockedQuery.error} onRetry={() => blockedQuery.refetch()} />;
  }

  return (
    <div className="editor-panel">
      <div className="card">
        <h3>Saacadaha toddobaadka</h3>
        <p className="muted">
          Waqtiga Soomaaliya. Ballamaha waxaa la bixiyaa 30-kii daqiiqoba mar gudaha saacadahan,
          ugu yaraan 2 saacadood ka hor.
        </p>

        {formError && <div className="error-box">{formError}</div>}

        <ul className="week-rules">
          {WEEK_ORDER.map((d) => {
            const rules = rulesQuery.data.filter((r) => r.weekday === d);
            return (
              <li key={d}>
                <span className="week-rules-day">{SOMALI_WEEKDAYS[d]}</span>
                <span className="day-rules">
                  {rules.length === 0 ? (
                    <span className="muted">Fasax</span>
                  ) : (
                    rules.map((r) => (
                      <span key={r.id} className="rule-pill">
                        {formatClock(r.start_time)} – {formatClock(r.end_time)}
                        <button
                          type="button"
                          aria-label="Ka saar"
                          onClick={() => removeRule.mutate(r.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="form-row form-row-3">
          <label>
            Maalinta
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {WEEK_ORDER.map((d) => (
                <option key={d} value={d}>
                  {SOMALI_WEEKDAYS[d]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bilowga
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            Dhammaadka
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={addRule.isPending}
          onClick={() => addRule.mutate()}
        >
          + Ku dar saacado
        </button>
        {removeRule.isError && <ErrorMessage error={removeRule.error} />}
      </div>

      <div className="card">
        <h3>Maalmaha fasaxa</h3>
        <p className="muted">Maalin aadan shaqeyneyn — waqti looma qabsan karo.</p>
        {blockedQuery.data.length === 0 ? (
          <p className="muted">Maalin fasax ah lama darin.</p>
        ) : (
          <ul className="hours-list">
            {blockedQuery.data.map((b) => (
              <li key={b.day}>
                <span>
                  {b.day}
                  {b.reason && <span className="muted"> · {b.reason}</span>}
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeBlocked.mutate(b.day)}
                >
                  Ka saar
                </button>
              </li>
            ))}
          </ul>
        )}
        <label>
          Taariikhda
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label>
          Sababta (ikhtiyaari)
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={addBlocked.isPending}
          onClick={() => addBlocked.mutate()}
        >
          + Ku dar maalin fasax
        </button>
        {removeBlocked.isError && <ErrorMessage error={removeBlocked.error} />}
      </div>
    </div>
  );
}

// ── Google Meet link ─────────────────────────────────────────────────────

function MeetTab({ settings }: { settings: Settings | undefined }) {
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<string | null>(null);
  const value = edited ?? settings?.meeting_url ?? "";
  const valid = value.trim() === "" || /^https:\/\/\S+$/i.test(value.trim());

  const save = useMutation({
    mutationFn: (v: string) => SettingsService.set("meeting_url", v.trim()),
    onSuccess: () => {
      setEdited(null);
      void queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });

  return (
    <div className="card admin-form">
      <h3>Link-ga Google Meet</h3>
      <p className="muted">
        Hal link oo joogto ah. Wuxuu gaarayaa ardayga <strong>kaliya marka uu bixiyo</strong> —
        cid kale ma arki karto. Ballan kasta waad u beddeli kartaa gudaha tab-ka Ballamaha.
      </p>
      {save.isSuccess && edited === null && <div className="success-box">La keydiyay.</div>}
      {save.isError && <ErrorMessage error={save.error} />}
      <label>
        Link-ga
        <input
          type="url"
          value={value}
          placeholder="https://meet.google.com/abc-defg-hij"
          onChange={(e) => setEdited(e.target.value)}
        />
      </label>
      {!valid && <span className="field-error">Link-gu waa inuu ku bilowdaa https://</span>}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={save.isPending || !valid}
          onClick={() => save.mutate(value)}
        >
          {save.isPending ? "Keydinaya…" : "Keydi"}
        </button>
      </div>
      <p className="muted">
        Lambarka WhatsApp waxaa laga beddelaa <Link to="/admin/services?tab=settings">Hire me → WhatsApp</Link>.
      </p>
    </div>
  );
}
