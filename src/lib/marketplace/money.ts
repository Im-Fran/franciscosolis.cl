/**
 * Amounts, as both halves of this feature have to print them.
 *
 * It lives apart from `store.ts` because the two callers have nothing else in common: the payment
 * modal on a product page is unauthenticated and public, and the sales console is behind the CMS
 * session. Importing the public store module into the console would drag its hooks and its content
 * client into a chunk that needs neither, and duplicating eleven lines of `Intl` would be the first
 * step towards two different ways of writing a price.
 */

/**
 * An amount as the currency the service quoted it in.
 *
 * CLP has no minor unit, so the fraction digits are zero rather than the two `Intl` would default
 * to — `$4.990` is the price, `$4.990,00` is a price nobody in Chile writes.
 */
export const formatAmount = (amount: number, currency: string, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(amount);
  } catch {
    /* An unknown currency code must not take the price off the screen. */
    return `${amount} ${currency}`;
  }
};
