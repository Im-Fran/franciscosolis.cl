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

/**
 * Whole minutes as hours, the way work is spoken about: `12 h 30 min`, `45 min`, `0 h`. A negative
 * figure (a cycle over budget) keeps its sign.
 */
export const formatMinutes = (minutes: number | null | undefined) => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  const total = Math.round(Math.abs(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const sign = minutes < 0 && total > 0 ? "−" : "";
  if (hours === 0) return rest === 0 ? "0 h" : `${sign}${rest} min`;
  return rest === 0 ? `${sign}${hours} h` : `${sign}${hours} h ${rest} min`;
};

/** Minutes as decimal hours — `12,5 h` — for a figure read beside others, like a usage bar. */
export const formatHoursDecimal = (minutes: number | null | undefined, language: string) => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  return `${new Intl.NumberFormat(language, {maximumFractionDigits: 1}).format(minutes / 60)} h`;
};

/**
 * An amount in a contract's currency. CLP has no decimals; UF carries up to two and is written after
 * the number, the way it is on an invoice (`UF 12,50`).
 */
export const formatMoney = (amount: number | null | undefined, currency: string, language: string) => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  if (currency === "CLP") {
    return new Intl.NumberFormat(language, {style: "currency", currency: "CLP", maximumFractionDigits: 0}).format(amount);
  }
  const number = new Intl.NumberFormat(language, {minimumFractionDigits: 0, maximumFractionDigits: 2}).format(amount);
  return `${currency} ${number}`;
};

/**
 * A `YYYY-MM-DD` calendar day as a date, without the time-zone shift `new Date("2026-03-01")` would
 * apply (it parses as UTC midnight, which is still February in Santiago).
 */
export const formatDay = (day: string | null | undefined, language: string) => {
  if (!day) return null;
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Intl.DateTimeFormat(language, {dateStyle: "medium", timeZone: "UTC"}).format(new Date(Date.UTC(year, month - 1, date)));
};

/** A calendar day moved by `days`, still as `YYYY-MM-DD`. */
export const addDays = (day: string, days: number) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
};

/** A calendar day moved by whole months, clamped to the end of a shorter month (31 Jan + 1 → 28 Feb). */
export const addMonths = (day: string, months: number) => {
  const [year, month, date] = day.split("-").map(Number);
  const last = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(date, last))).toISOString().slice(0, 10);
};
