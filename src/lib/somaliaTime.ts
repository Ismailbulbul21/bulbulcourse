/**
 * Booking times are always shown in Somalia time and labelled as such, so a
 * student abroad never has to guess which timezone a session is in.
 */
export const SOMALIA_TZ = "Africa/Mogadishu";

/** Index 0 = Sunday, matching Postgres extract(dow) and Date#getDay. */
export const SOMALI_WEEKDAYS = [
  "Axad",
  "Isniin",
  "Talaado",
  "Arbaco",
  "Khamiis",
  "Jimco",
  "Sabti",
] as const;

const EN_SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function somaliaWeekday(date: Date): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: SOMALIA_TZ,
    weekday: "short",
  }).format(date);
  return EN_SHORT_WEEKDAYS.indexOf(short);
}

/** "2026-09-14" — the calendar day in Somalia, for grouping slots by day. */
export function somaliaDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SOMALIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** "Isniin, 14 Sep" */
export function formatSomaliaDay(iso: string): string {
  const date = new Date(iso);
  const dayMonth = new Intl.DateTimeFormat("en-GB", {
    timeZone: SOMALIA_TZ,
    day: "numeric",
    month: "short",
  }).format(date);
  return `${SOMALI_WEEKDAYS[somaliaWeekday(date)]}, ${dayMonth}`;
}

/** "4:00 PM" */
export function formatSomaliaTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SOMALIA_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "Isniin, 14 Sep · 4:00 PM – 5:00 PM" */
export function formatSomaliaRange(startIso: string, endIso: string): string {
  return `${formatSomaliaDay(startIso)} · ${formatSomaliaTime(startIso)} – ${formatSomaliaTime(endIso)}`;
}

/** "16:00:00" → "4:00 PM" — weekly hours are already stored in Somalia time. */
export function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}
