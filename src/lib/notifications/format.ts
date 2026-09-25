/**
 * "3 minutes ago", in the reader's language.
 *
 * A notification is read against the moment it arrived, not against a calendar, so the bell and
 * the list say how long ago rather than when. Anything older than a week reads as a date instead:
 * "43 days ago" is harder to place than the date it stands for.
 */
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
];

export const formatRelative = (value: string, language: string, now = Date.now()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  let delta = (date.getTime() - now) / 1000;
  const format = new Intl.RelativeTimeFormat(language, {numeric: "auto"});
  for (const [unit, size] of UNITS) {
    if (Math.abs(delta) < size) return format.format(Math.round(delta), unit);
    delta /= size;
  }
  return new Intl.DateTimeFormat(language, {dateStyle: "medium"}).format(date);
};

/**
 * Whether a notification's `url` is somewhere this site can route to.
 *
 * The contract says a path starting with `/`, and this holds it to that: a protocol-relative `//`
 * or a backslash would name another host while passing a naive prefix test, and a notification is
 * not a place an off-site link should come from.
 */
export const isSitePath = (url: string | null | undefined): url is string =>
  typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.includes("\\");
