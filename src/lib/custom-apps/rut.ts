/**
 * The Chilean RUT, checked and normalised the way the service stores it: `12345678-5`, no dots,
 * uppercase `K`.
 *
 * The service is the authority — it runs the same check and answers 422 — but a typo in a tax id is
 * the kind of mistake worth catching while the cursor is still in the field, and the check digit
 * makes it cheap to catch: one transposed digit is caught every time.
 */

/** Strips the dots, dashes and spaces people write a RUT with, and uppercases the `k`. */
const compact = (value: string) => value.replace(/[.\-\s]/g, "").toUpperCase();

/**
 * The check digit of a RUT body, by the module 11 algorithm: the digits from the right, weighted
 * 2, 3, 4, 5, 6, 7 and around again, and eleven minus the remainder — where 11 is `0` and 10 is `K`.
 */
export const rutCheckDigit = (body: string) => {
  let sum = 0;
  let weight = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const digit = 11 - (sum % 11);
  return digit === 11 ? "0" : digit === 10 ? "K" : String(digit);
};

export type RutCheck = {ok: true; value: string} | {ok: false; reason: "format" | "check_digit"};

/**
 * Validates a RUT as typed and returns it normalised. An empty value is not this function's
 * business — whether the field is optional is the form's call.
 */
export const parseRut = (value: string): RutCheck => {
  const raw = compact(value);
  const match = /^(\d{1,9})([\dK])$/.exec(raw);
  if (!match) return {ok: false, reason: "format"};

  /* Leading zeros carry no weight in the sum, and the stored form has none. */
  const body = match[1].replace(/^0+(?=\d)/, "");
  const digit = match[2];
  if (rutCheckDigit(body) !== digit) return {ok: false, reason: "check_digit"};
  return {ok: true, value: `${body}-${digit}`};
};

/**
 * `12.345.678-5`, for reading. The stored form is what gets compared and searched; this is only
 * how a person expects to see one.
 */
export const formatRut = (value: string | null | undefined) => {
  if (!value) return null;
  const [body, digit] = value.split("-");
  if (!body || !digit) return value;
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${digit}`;
};
