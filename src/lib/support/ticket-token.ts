/**
 * The per-ticket access secret, and keeping it out of places it must not be.
 *
 * The link in a support email looks like `…/tickets/FS-1042#k=<secret>`. The secret rides in the
 * **fragment**, which is the one part of a URL a browser never sends to a server: it stays out of
 * access logs, out of the `Referer` header of every outbound link the page renders, and out of
 * anything sitting between the browser and the origin.
 *
 * That guarantee only holds while the fragment is *in the fragment*. So the first thing the ticket
 * screen does is read it, put it in `sessionStorage` and erase it from the address bar — before
 * anything else renders, because a third-party script or a link with a `Referer` only has to see it
 * once.
 */

const storageKey = (reference: string) => `fs.support.ticket.${reference.toUpperCase()}`;

/** `sessionStorage` throws in a private window with site data blocked, and that is not a failure. */
const safely = <T>(operation: () => T, fallback: T): T => {
  try {
    return operation();
  } catch {
    return fallback;
  }
};

/**
 * Takes the secret out of `location.hash`, remembers it for this tab, and rewrites the address bar
 * without it. Call it from a layout effect, before the first paint.
 */
export const captureTicketToken = (reference: string): string | null => {
  const hash = window.location.hash;
  const match = /[#&]k=([^&]+)/.exec(hash);

  if (match?.[1]) {
    const token = decodeURIComponent(match[1]);
    safely(() => sessionStorage.setItem(storageKey(reference), token), undefined);
    /*
     * `replaceState` rather than assigning `location.hash`: assigning adds a history entry and
     * leaves the old one — with the secret in it — one Back press away.
     */
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return token;
  }

  return safely(() => sessionStorage.getItem(storageKey(reference)), null);
};

export const readTicketToken = (reference: string): string | null =>
  safely(() => sessionStorage.getItem(storageKey(reference)), null);

export const forgetTicketToken = (reference: string): void => {
  safely(() => sessionStorage.removeItem(storageKey(reference)), undefined);
};
