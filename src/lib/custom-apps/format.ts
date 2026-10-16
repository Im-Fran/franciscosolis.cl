import {formatDate} from "@/lib/auth/format.ts";
import {formatRelativeTime} from "@/pages/cms/audit/relative-time.ts";

/**
 * Presentation helpers for telemetry, which the rest of the site has no use for: sizes, durations
 * and "last seen". Everything takes the interface language rather than reading it, so the numbers
 * follow the language toggle like the words around them do.
 */

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Binary multiples under the familiar names: a machine reports 16 GB of RAM meaning 16 GiB, and a
 * panel that said "17.2 GB" for it would be correct and unrecognisable.
 */
export const formatBytes = (value: number | null | undefined, language: string) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  let amount = Math.abs(value);
  let unit = 0;
  while (amount >= 1024 && unit < BYTE_UNITS.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || amount >= 100 ? 0 : 1;
  const number = new Intl.NumberFormat(language, {maximumFractionDigits: digits}).format(amount);
  return `${value < 0 ? "−" : ""}${number} ${BYTE_UNITS[unit]}`;
};

export const formatPercent = (value: number | null | undefined, language: string, digits = 0) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat(language, {maximumFractionDigits: digits}).format(value)} %`;
};

export const formatNumber = (value: number | null | undefined, language: string, digits = 0) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(language, {maximumFractionDigits: digits}).format(value);
};

/**
 * A span of time in the two largest units that matter — `3 d 4 h`, `2 h 15 min`, `45 min`, `30 s`.
 * Usage is read at the scale of hours, and "8 h 3 min 12 s" is precision nobody plans around.
 */
export const formatDuration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;

  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  return `${minutes} min`;
};

/** Hours with one decimal, for chart axes where `2 h 15 min` would not fit under a bar. */
export const formatHours = (seconds: number, language: string) =>
  `${new Intl.NumberFormat(language, {maximumFractionDigits: 1}).format(seconds / 3600)} h`;

/**
 * "3 min ago" for anything recent and the date for anything older — a device last seen in March
 * is better described by "Mar 3" than by "31 weeks ago".
 */
export const formatLastSeen = (value: string | null | undefined, language: string) =>
  formatRelativeTime(value, language) ?? formatDate(value, language);

/** `YYYY-MM-DD` for an instant, in a given zone — the shape the service keys its days on. */
export const dayIn = (date: Date, timeZone: string) => {
  try {
    /* `en-CA` is the one locale whose short date is already ISO-ordered. */
    return new Intl.DateTimeFormat("en-CA", {timeZone, year: "numeric", month: "2-digit", day: "2-digit"}).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

/**
 * The `days` calendar days ending today in `timeZone`, oldest first, as the service's `YYYY-MM-DD`
 * keys. Counted back on the calendar from today's key rather than in 24-hour steps from now, which
 * would skip a day across a 23-hour DST change.
 */
export const lastDays = (days: number, timeZone: string) => {
  const [year, month, day] = dayIn(new Date(), timeZone).split("-").map(Number);
  return Array.from({length: days}, (_, index) =>
    new Date(Date.UTC(year, month - 1, day - (days - 1 - index))).toISOString().slice(0, 10),
  );
};

/**
 * A `YYYY-MM-DD` from a date input as the instant that day starts, here; `endOfDay` for the bound
 * after it — so "to the 3rd" includes the whole of the 3rd.
 */
export const dayBound = (value: string, endOfDay: boolean) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + (endOfDay ? 1 : 0));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
