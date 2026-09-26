/**
 * The hosted authorization screen's view of the auth service.
 *
 * `api.franciscosolis.cl` is a backend and renders nothing, so the one step of an OAuth flow that
 * has to face a human belongs here: its `GET /oauth/authorize` parks a validated request and sends
 * the browser to `/apps/auth?request=<handle>`. The two calls below are the whole protocol from
 * this side — read what the parked request is, then start one of its providers.
 *
 * Nothing here is tied to an `AuthClient`: the request being signed in to belongs to whichever
 * application started it, which may not be one of this site's own. Neither endpoint is
 * authenticated, and neither touches a session — the handle in the URL is the only credential, and
 * holding it grants nothing on its own.
 */

import {webHttp} from "@/lib/auth/client.ts";
import type {MagicLinkAccepted, PendingAuthorizationRequest} from "@/lib/auth/types.ts";

/** Base path of the parked request, with the handle escaped for use in a URL. */
const parked = (handle: string) => `/oauth/authorize/${encodeURIComponent(handle)}`;

/** What the user is signing in to, and which providers this deployment can offer them. */
export const loadAuthorizationRequest = (handle: string, signal?: AbortSignal) =>
  webHttp.request<PendingAuthorizationRequest>(parked(handle), {auth: false, signal});

/**
 * Emails a sign-in link that resumes this parked request. Answers the same way whether or not the
 * address can sign in, so this screen cannot be used to discover which addresses have an account.
 *
 * `turnstileToken` is the widget's answer, and it is only sent where the parked request said a
 * check is required — a deployment with no Turnstile keypair has no widget to solve and asks for
 * nothing. The service verifies it against Cloudflare before it writes or sends anything, so a
 * refused token costs exactly one round trip and leaves no trace.
 *
 * `locale` is the language this screen is showing, so the email arrives in the same one — the
 * account may not have a language stored yet, and an address nobody has seen never does.
 */
export const requestParkedMagicLink = (
  handle: string,
  email: string,
  turnstileToken?: string | null,
  locale?: string,
) =>
  webHttp.request<MagicLinkAccepted>(`${parked(handle)}/magic-link`, {
    auth: false,
    method: "POST",
    json: {email, ...(turnstileToken ? {turnstile_token: turnstileToken} : {}), ...(locale ? {locale} : {})},
  });
