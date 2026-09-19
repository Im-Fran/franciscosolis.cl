import {createAuthClient} from "@/lib/auth/auth-client.ts";
import {createHttpClient} from "@/lib/auth/client.ts";
import {CMS_AUTH_CONFIG, CMS_BASE_URL} from "@/lib/cms/config.ts";
import type {
  AuditEntry,
  AuditQuery,
  CmsCollection,
  CmsEditor,
  CmsStatus,
  ContentItem,
  ContentPayload,
  ContentQuery,
  EmailMessage,
  EmailQuery,
  EmailTemplate,
  EmailTemplatePayload,
  LegalDocument,
  LegalPayload,
  NewContent,
  NewEmailTemplate,
  NewLegal,
  ReorderItem,
  SendEmail,
} from "@/lib/cms/types.ts";
import type {TranslationDraft, TranslationDraftRequest} from "@/lib/prose/types.ts";

/**
 * The CMS's own auth stack. Built once for the whole app: a second instance over the same storage
 * namespace would not hear about this one's sign-ins within the tab.
 */
export const cmsAuth = createAuthClient(CMS_AUTH_CONFIG);

/** The CMS API is a different service than the issuer, called with the CMS session's tokens. */
const http = createHttpClient(CMS_BASE_URL, cmsAuth.session);

/**
 * The list endpoints declare their numeric filters as digit strings, so numbers are stringified
 * here and empty values dropped rather than sent as `?search=`.
 */
const query = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

/** Path segments come from the API's own slugs, but they are still interpolated into a URL. */
const seg = (value: string) => encodeURIComponent(value);

export const cmsApi = {
  /** Public: what this CMS is and which collections it manages. */
  status: (signal?: AbortSignal) => http.request<CmsStatus>("/", {auth: false, signal}),

  /** Public: the collections, with the names and descriptions a navigation needs. */
  collections: (signal?: AbortSignal) => http.request<CmsCollection[]>("/collections", {auth: false, signal}),

  /**
   * The "am I still signed in" probe, and the check that this account is allowed in here at all:
   * the API answers 401 without a live session and 403 for an account the CMS does not admit.
   */
  me: (signal?: AbortSignal) => http.request<CmsEditor>("/admin/me", {signal}),

  /**
   * A machine-translated draft of one prose field, for the translation dialog on that field.
   *
   * It writes nothing: the draft comes back as a string and is saved, edited or discarded through
   * the ordinary update that saves every other override. A model that failed answers `translation:
   * null` with a 200, so only a transport or authorisation failure rejects here.
   */
  translate: (body: TranslationDraftRequest, signal?: AbortSignal) =>
    http.request<TranslationDraft>("/admin/translate", {method: "POST", json: body, signal}),

  /* ── Content ────────────────────────────────────────────────────────────── */

  content: {
    /** Every entry of a collection, drafts and archived ones included. */
    list: (collection: string, params: ContentQuery = {}, signal?: AbortSignal) =>
      http.request<ContentItem[]>(`/admin/content/${seg(collection)}${query({...params})}`, {signal}),

    get: (collection: string, id: string, signal?: AbortSignal) =>
      http.request<ContentItem>(`/admin/content/${seg(collection)}/${seg(id)}`, {signal}),

    create: (collection: string, body: NewContent) =>
      http.request<ContentItem>(`/admin/content/${seg(collection)}`, {method: "POST", json: body}),

    /**
     * Omitted fields are left alone and an explicit `null` clears one — but `data` is replaced
     * wholesale rather than merged, so a caller sending it at all has to send the complete object.
     */
    update: (collection: string, id: string, body: ContentPayload) =>
      http.request<ContentItem>(`/admin/content/${seg(collection)}/${seg(id)}`, {method: "PATCH", json: body}),

    remove: (collection: string, id: string) =>
      http.request<void>(`/admin/content/${seg(collection)}/${seg(id)}`, {method: "DELETE"}),

    /** One call carries the whole new order; the service takes up to 200 items at a time. */
    reorder: (collection: string, items: ReorderItem[]) =>
      http.request<void>(`/admin/content/${seg(collection)}/reorder`, {method: "POST", json: {items}}),
  },

  /* ── Legal ──────────────────────────────────────────────────────────────── */

  legal: {
    list: (signal?: AbortSignal) => http.request<LegalDocument[]>("/admin/legal", {signal}),

    get: (id: string, signal?: AbortSignal) => http.request<LegalDocument>(`/admin/legal/${seg(id)}`, {signal}),

    create: (body: NewLegal) => http.request<LegalDocument>("/admin/legal", {method: "POST", json: body}),

    update: (id: string, body: LegalPayload) =>
      http.request<LegalDocument>(`/admin/legal/${seg(id)}`, {method: "PATCH", json: body}),

    remove: (id: string) => http.request<void>(`/admin/legal/${seg(id)}`, {method: "DELETE"}),
  },

  /* ── Email templates ────────────────────────────────────────────────────── */

  templates: {
    list: (signal?: AbortSignal) => http.request<EmailTemplate[]>("/admin/email-templates", {signal}),

    get: (id: string, signal?: AbortSignal) =>
      http.request<EmailTemplate>(`/admin/email-templates/${seg(id)}`, {signal}),

    create: (body: NewEmailTemplate) =>
      http.request<EmailTemplate>("/admin/email-templates", {method: "POST", json: body}),

    update: (id: string, body: EmailTemplatePayload) =>
      http.request<EmailTemplate>(`/admin/email-templates/${seg(id)}`, {method: "PATCH", json: body}),

    remove: (id: string) => http.request<void>(`/admin/email-templates/${seg(id)}`, {method: "DELETE"}),
  },

  /* ── Emails ─────────────────────────────────────────────────────────────── */

  emails: {
    list: (params: EmailQuery = {}, signal?: AbortSignal) =>
      http.request<EmailMessage[]>(`/admin/emails${query({...params})}`, {signal}),

    get: (id: string, signal?: AbortSignal) => http.request<EmailMessage>(`/admin/emails/${seg(id)}`, {signal}),

    /**
     * Sends synchronously and answers with the logged message. A provider failure comes back as a
     * `failed` record on a successful response rather than as an HTTP error — the attempt was
     * recorded either way — so a caller has to read `status`, not just the absence of a throw.
     */
    send: (body: SendEmail) => http.request<EmailMessage>("/admin/emails", {method: "POST", json: body}),
  },

  /* ── Audit ──────────────────────────────────────────────────────────────── */

  audit: (params: AuditQuery = {}, signal?: AbortSignal) =>
    http.request<AuditEntry[]>(`/admin/audit${query({...params})}`, {signal}),
};
