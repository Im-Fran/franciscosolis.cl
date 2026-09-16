/** Form and input helpers shared by the administration panels. */

/** The slug shape the API validates against: lowercase, digits and inner hyphens, up to 80 chars. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/**
 * Derives a slug from a title. Accents are stripped rather than dropped, so "Certificación" turns
 * into `certificacion` instead of `certificaci-n`.
 */
export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

/**
 * An ISO instant as `<input type="datetime-local">` wants it — local time, no zone, minutes.
 * Returns an empty string for anything unparseable, which is what an empty field renders as.
 */
export const toDateTimeLocal = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** The reverse: a local datetime back to an ISO instant, or `null` when the field was cleared. */
export const fromDateTimeLocal = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Trims a text field and reports an empty one as `null`, which is how the API clears a value. */
export const orNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** Splits a comma or newline separated list into trimmed, de-duplicated entries. */
export const splitList = (value: string) => [
  ...new Set(
    value
      .split(/[\n,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  ),
];
