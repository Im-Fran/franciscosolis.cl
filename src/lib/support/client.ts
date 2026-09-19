import {createAuthClient} from "@/lib/auth/auth-client.ts";
import {createHttpClient} from "@/lib/auth/client.ts";
import {SUPPORT_AUTH_CONFIG, SUPPORT_BASE_URL} from "@/lib/support/config.ts";
import type {
  AdminArticle,
  AdminCategory,
  AssistAnswer,
  Label,
  ParticipantTag,
  SupportAgent,
  SupportStatus,
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketSummary,
  TimelineEntry,
} from "@/lib/support/types.ts";
import type {TranslationDraft, TranslationDraftRequest} from "@/lib/prose/types.ts";

/**
 * The support console's own auth stack. Built once for the whole app: a second instance over the
 * same storage namespace would not hear about this one's sign-ins within the tab.
 */
export const supportAuth = createAuthClient(SUPPORT_AUTH_CONFIG);

/** The support API is a different service than the issuer, called with the console's tokens. */
const http = createHttpClient(SUPPORT_BASE_URL, supportAuth.session);

const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

const seg = (value: string) => encodeURIComponent(value);

export type InboxQuery = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee?: string;
  unassigned?: boolean;
  requester?: string;
  label?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export const supportApi = {
  /** Public: the vocabularies the console builds its filters and its timeline renderer from. */
  status: (signal?: AbortSignal) => http.request<SupportStatus>("/", {auth: false, signal}),

  /**
   * The "am I signed in and allowed in here" probe. 401 without a live session, 403 for an account
   * the support service does not admit — which is one screen rather than a dozen failing panels.
   */
  me: (signal?: AbortSignal) => http.request<SupportAgent>("/admin/me", {signal}),

  /**
   * A machine-translated draft of one prose field, for the translation dialog on that field.
   *
   * It writes nothing: the draft comes back as a string and is saved, edited or discarded through
   * the ordinary update that saves every other override. A model that failed answers `translation:
   * null` with a 200, so only a transport or authorisation failure rejects here.
   */
  translate: (body: TranslationDraftRequest, signal?: AbortSignal) =>
    http.request<TranslationDraft>("/admin/translate", {method: "POST", json: body, signal}),

  tickets: {
    list: (params: InboxQuery = {}, signal?: AbortSignal) =>
      http.request<TicketSummary[]>(`/admin/tickets${query({...params})}`, {signal}),

    get: (id: string, signal?: AbortSignal) => http.request<Ticket>(`/admin/tickets/${seg(id)}`, {signal}),

    timeline: (id: string, signal?: AbortSignal) =>
      http.request<TimelineEntry[]>(`/admin/tickets/${seg(id)}/timeline`, {signal}),

    update: (id: string, payload: Partial<Pick<Ticket, "subject" | "status" | "priority" | "locale">>) =>
      http.request<Ticket>(`/admin/tickets/${seg(id)}`, {method: "PATCH", json: payload}),

    remove: (id: string) => http.request<void>(`/admin/tickets/${seg(id)}`, {method: "DELETE"}),

    /** `note` never leaves the support team; `reply` is the conversation, and starts the 30-minute clock. */
    reply: (id: string, body: string, kind: "reply" | "note" = "reply") =>
      http.request<{id: string; seq: number}>(`/admin/tickets/${seg(id)}/messages`, {
        method: "POST",
        json: {body, kind},
      }),

    assign: (id: string, email: string | null) =>
      http.request<{assignee_email: string | null}>(`/admin/tickets/${seg(id)}/assignee`, {
        method: "PUT",
        json: {email},
      }),

    addParticipant: (id: string, email: string, name?: string, tag?: ParticipantTag | null) =>
      http.request<{id: string}>(`/admin/tickets/${seg(id)}/participants`, {method: "POST", json: {email, name, tag}}),

    removeParticipant: (id: string, participantId: string) =>
      http.request<void>(`/admin/tickets/${seg(id)}/participants/${seg(participantId)}`, {method: "DELETE"}),

    setParticipantTag: (id: string, participantId: string, tag: ParticipantTag | null) =>
      http.request<{id: string; tag: ParticipantTag | null}>(
        `/admin/tickets/${seg(id)}/participants/${seg(participantId)}`,
        {method: "PATCH", json: {tag}},
      ),

    addLabel: (id: string, labelId: string) =>
      http.request<void>(`/admin/tickets/${seg(id)}/labels/${seg(labelId)}`, {method: "POST"}),

    removeLabel: (id: string, labelId: string) =>
      http.request<void>(`/admin/tickets/${seg(id)}/labels/${seg(labelId)}`, {method: "DELETE"}),
  },

  labels: {
    list: (signal?: AbortSignal) => http.request<Label[]>("/admin/labels", {signal}),
    create: (payload: Partial<Label>) => http.request<Label>("/admin/labels", {method: "POST", json: payload}),
    update: (id: string, payload: Partial<Label>) =>
      http.request<Label>(`/admin/labels/${seg(id)}`, {method: "PATCH", json: payload}),
    remove: (id: string) => http.request<void>(`/admin/labels/${seg(id)}`, {method: "DELETE"}),
  },

  help: {
    categories: (signal?: AbortSignal) => http.request<AdminCategory[]>("/admin/help/categories", {signal}),
    createCategory: (payload: Partial<AdminCategory>) =>
      http.request<AdminCategory>("/admin/help/categories", {method: "POST", json: payload}),
    updateCategory: (id: string, payload: Partial<AdminCategory>) =>
      http.request<AdminCategory>(`/admin/help/categories/${seg(id)}`, {method: "PATCH", json: payload}),
    removeCategory: (id: string) => http.request<void>(`/admin/help/categories/${seg(id)}`, {method: "DELETE"}),

    articles: (params: {status?: string; limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      http.request<AdminArticle[]>(`/admin/help/articles${query({...params})}`, {signal}),
    article: (id: string, signal?: AbortSignal) =>
      http.request<AdminArticle>(`/admin/help/articles/${seg(id)}`, {signal}),
    createArticle: (payload: Partial<AdminArticle>) =>
      http.request<AdminArticle>("/admin/help/articles", {method: "POST", json: payload}),
    updateArticle: (id: string, payload: Partial<AdminArticle>) =>
      http.request<AdminArticle>(`/admin/help/articles/${seg(id)}`, {method: "PATCH", json: payload}),
    removeArticle: (id: string) => http.request<void>(`/admin/help/articles/${seg(id)}`, {method: "DELETE"}),
    reindex: (id: string) =>
      http.request<{search_rows: number; vectors: number}>(`/admin/help/articles/${seg(id)}/reindex`, {method: "POST"}),
  },

  /**
   * Drafts an answer from the help centre.
   *
   * The draft lands in the composer for an agent to read, edit and send. It is never sent on its
   * own, and the screens must not grow a button that does.
   */
  assist: (query_: string, locale?: string, ticketId?: string) =>
    http.request<AssistAnswer>("/admin/assist", {method: "POST", json: {query: query_, locale, ticket_id: ticketId}}),

  emails: (params: {limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
    http.request<Record<string, unknown>[]>(`/admin/emails${query({...params})}`, {signal}),

  notifications: (params: {state?: string; limit?: number} = {}, signal?: AbortSignal) =>
    http.request<Record<string, unknown>[]>(`/admin/notifications${query({...params})}`, {signal}),

  audit: (params: {event?: string; limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
    http.request<Record<string, unknown>[]>(`/admin/audit${query({...params})}`, {signal}),
};
