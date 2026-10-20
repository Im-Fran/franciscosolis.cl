/**
 * Wall-clock time in one named zone, whatever zone the browser is in.
 *
 * Maintenance windows are planned and read in Santiago time — the clients are Chilean, the service
 * keys its heatmap on Santiago's clock and its emails print Santiago's time — but the person using
 * the panel may be travelling, and a `<input type="datetime-local">` speaks the *browser's* zone. So
 * the panel never hands a local input to `new Date()`: these helpers convert between an instant and
 * the wall-clock time it is in the zone the service names, and format instants there.
 *
 * Kept free of the panel's other modules, because the public approval page uses it too and must not
 * pull the panel into its bundle.
 */

/** The zone maintenances are planned in until the service says otherwise. */
export const MAINTENANCE_TIMEZONE = "America/Santiago";

type Parts = {year: number; month: number; day: number; hour: number; minute: number; second: number};

const partFormatters = new Map<string, Intl.DateTimeFormat>();

const partsIn = (date: Date, timeZone: string): Parts => {
  let formatter = partFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {year: read("year"), month: read("month"), day: read("day"), hour: read("hour") % 24, minute: read("minute"), second: read("second")};
};

/** How far ahead of UTC `timeZone`'s clock is at `date`, in milliseconds. */
const offsetAt = (date: Date, timeZone: string) => {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** An instant as `YYYY-MM-DDTHH:MM` on `timeZone`'s clock — what a `datetime-local` input shows. */
export const toZonedInput = (value: string | Date | null | undefined, timeZone: string) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = partsIn(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

/**
 * `YYYY-MM-DDTHH:MM` read on `timeZone`'s clock, as an ISO instant; null when it does not parse.
 *
 * Two passes: the offset is read at a first guess and again at the corrected instant, which settles
 * on the right side of a daylight-saving change. A wall time skipped by the change (the hour that does
 * not exist) lands an hour later, which is what a person typing it would expect.
 */
export const fromZonedInput = (value: string, timeZone: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(wall)) return null;
  const first = wall - offsetAt(new Date(wall), timeZone);
  const second = wall - offsetAt(new Date(first), timeZone);
  return new Date(second).toISOString();
};

/** The calendar day (`YYYY-MM-DD`) an instant falls on, on `timeZone`'s clock. */
export const zonedDay = (value: string | Date, timeZone: string) => toZonedInput(value, timeZone).slice(0, 10);

/** Weekday (0 = Monday, the heatmap's order) and hour of an instant on `timeZone`'s clock. */
export const zonedSlot = (value: string | Date, timeZone: string) => {
  const date = value instanceof Date ? value : new Date(value);
  const p = partsIn(date, timeZone);
  const weekday = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
  return {weekday, hour: p.hour};
};

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (language: string, timeZone: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${language}|${timeZone}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language, {...options, timeZone});
    formatters.set(key, formatter);
  }
  return formatter;
};

const DATE: Intl.DateTimeFormatOptions = {weekday: "short", day: "numeric", month: "short", year: "numeric"};
const LONG_DATE: Intl.DateTimeFormatOptions = {weekday: "long", day: "numeric", month: "long", year: "numeric"};
const TIME: Intl.DateTimeFormatOptions = {hour: "2-digit", minute: "2-digit", hourCycle: "h23"};

/** `lun, 3 nov 2026, 02:00` on `timeZone`'s clock. */
export const formatZonedDateTime = (value: string | null | undefined, language: string, timeZone: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatterFor(language, timeZone, DATE).format(date)}, ${formatterFor(language, timeZone, TIME).format(date)}`;
};

/** `02:00` on `timeZone`'s clock. */
export const formatZonedTime = (value: string, language: string, timeZone: string) =>
  formatterFor(language, timeZone, TIME).format(new Date(value));

/** `lunes, 3 de noviembre de 2026` on `timeZone`'s clock, for a card's heading. */
export const formatZonedLongDate = (value: string, language: string, timeZone: string) =>
  formatterFor(language, timeZone, LONG_DATE).format(new Date(value));

/**
 * A window as one line: `lun, 3 nov 2026, 02:00–04:00`, or with both dates when it crosses midnight
 * (`lun, 3 nov 2026, 22:00 – mar, 4 nov 2026, 02:00`).
 */
export const formatZonedWindow = (startsAt: string, endsAt: string, language: string, timeZone: string) => {
  const sameDay = zonedDay(startsAt, timeZone) === zonedDay(endsAt, timeZone);
  if (sameDay) {
    return `${formatterFor(language, timeZone, DATE).format(new Date(startsAt))}, ${formatZonedTime(startsAt, language, timeZone)}–${formatZonedTime(endsAt, language, timeZone)}`;
  }
  return `${formatZonedDateTime(startsAt, language, timeZone)} – ${formatZonedDateTime(endsAt, language, timeZone)}`;
};

/** The instant a `YYYY-MM-DD` day starts on `timeZone`'s clock, as ISO. */
export const zonedDayStart = (day: string, timeZone: string) => fromZonedInput(`${day}T00:00`, timeZone);
