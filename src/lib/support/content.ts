import {createHttpClient} from "@/lib/auth/client.ts";
import {webAuth} from "@/lib/auth/auth-client.ts";
import {SUPPORT_BASE_URL} from "@/lib/support/config.ts";
import {readTicketToken} from "@/lib/support/ticket-token.ts";
import type {
  CreatedTicket,
  HelpArticle,
  HelpArticleSummary,
  HelpCategory,
  NewTicket,
  RequesterTicket,
  SearchHit,
  SearchResults,
  SupportStatus,
  TimelineEntry,
} from "@/lib/support/types.ts";

/**
 * The public half of the support API: the help centre, opening a ticket, and following one.
 *
 * Deliberately separate from `client.ts`, for the same reason `src/lib/pages/content.ts` is separate
 * from the CMS's: importing the console's client would drag the whole OAuth stack into the bundle a
 * visitor reading an FAQ downloads.
 *
 * It is built over the *site's* session rather than the support console's, which is what makes the
 * hybrid identity work: a signed-in visitor's token is sent where one exists, so their own tickets
 * resolve without a link, and everything still works for somebody who has no account at all.
 */
const http = createHttpClient(SUPPORT_BASE_URL, webAuth.session);

const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

const seg = (value: string) => encodeURIComponent(value);

/**
 * The header the ticket secret travels in.
 *
 * A custom `Ticket` scheme rather than `Bearer`, so the service can tell the two apart instead of
 * trying to verify a random string as a JWT and answering with a confusing 401.
 */
const ticketHeaders = (reference: string): Record<string, string> => {
  const token = readTicketToken(reference);
  return token ? {Authorization: `Ticket ${token}`} : {};
};

export const supportContent = {
  status: (signal?: AbortSignal) => http.request<SupportStatus>("/", {auth: false, signal}),

  categories: (locale?: string, signal?: AbortSignal) =>
    http.request<HelpCategory[]>(`/help/categories${query({locale})}`, {auth: false, signal}),

  category: (slug: string, locale?: string, signal?: AbortSignal) =>
    http.request<HelpCategory>(`/help/categories/${seg(slug)}${query({locale})}`, {auth: false, signal}),

  articles: (params: {category?: string; featured?: boolean; locale?: string; limit?: number} = {}, signal?: AbortSignal) =>
    http.request<HelpArticleSummary[]>(`/help/articles${query({...params})}`, {auth: false, signal}),

  article: (slug: string, locale?: string, signal?: AbortSignal) =>
    http.request<HelpArticle>(`/help/articles/${seg(slug)}${query({locale})}`, {auth: false, signal}),

  /**
   * The search box.
   *
   * `fallback_locale` rides alongside the hits rather than inside them: when a Spanish search finds
   * only English articles the screen should say so, and that is a fact about the *search*, not about
   * any one result.
   */
  search: async (q: string, locale?: string, signal?: AbortSignal): Promise<SearchResults> => {
    const response = await fetch(
      `${SUPPORT_BASE_URL}/help/search${query({q, locale})}`,
      {signal},
    );
    if (!response.ok) return {hits: [], fallbackLocale: false};
    const body = (await response.json()) as {data: SearchHit[]; meta?: {fallback_locale?: boolean}};
    return {hits: body.data ?? [], fallbackLocale: Boolean(body.meta?.fallback_locale)};
  },

  rateArticle: (slug: string, helpful: boolean, locale?: string) =>
    http.request<void>(`/help/articles/${seg(slug)}/feedback`, {
      auth: false,
      method: "POST",
      json: {helpful, locale},
    }),

  openTicket: (ticket: NewTicket) => http.request<CreatedTicket>("/tickets", {method: "POST", json: ticket}),

  resendLink: (reference: string, email: string) =>
    http.request<{message: string}>("/tickets/resend-link", {auth: false, method: "POST", json: {reference, email}}),

  ticket: (reference: string, signal?: AbortSignal) =>
    http.request<RequesterTicket>(`/tickets/${seg(reference)}`, {headers: ticketHeaders(reference), signal}),

  timeline: (reference: string, signal?: AbortSignal) =>
    http.request<TimelineEntry[]>(`/tickets/${seg(reference)}/timeline`, {headers: ticketHeaders(reference), signal}),

  reply: (reference: string, body: string) =>
    http.request<{seq: number}>(`/tickets/${seg(reference)}/messages`, {
      method: "POST",
      headers: ticketHeaders(reference),
      json: {body},
    }),

  /** Tickets belonging to the signed-in account. Needs the site's session, not a link. */
  myTickets: (signal?: AbortSignal) => http.request<RequesterTicket[]>("/me/tickets", {signal}),

  /** Links tickets opened anonymously with this account's verified email to the account. */
  claimTickets: () => http.request<{claimed: number}>("/me/tickets/claim", {method: "POST"}),
};
