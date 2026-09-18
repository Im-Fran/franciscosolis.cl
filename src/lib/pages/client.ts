import {createHttpClient} from "@/lib/auth/client.ts";
import {cmsAuth} from "@/lib/cms/client.ts";
import {PAGES_BASE_URL} from "@/lib/pages/config.ts";
import type {
  Application,
  ApplicationPayload,
  ApplicationUpdate,
  ContentStatus,
  NewApplication,
  NewUpdate,
  NewWikiPage,
  PagesStatus,
  ReorderItem,
  UpdatePayload,
  WikiNode,
  WikiPage,
  WikiPayload,
} from "@/lib/pages/types.ts";

/**
 * The editorial client for the Standalone App Pages service.
 *
 * It is a different service than the CMS but the *same session*: these screens live at
 * `/cms/pages`, inside the CMS's `AuthProvider`, and the service accepts the CMS's audience for
 * exactly that reason. Reusing `cmsAuth.session` rather than building a second auth stack is what
 * keeps that true — a client of its own would mint a second token, over a second storage namespace,
 * for an application nobody registered.
 *
 * The public half is in `content.ts` and shares none of this: it is unauthenticated, and importing
 * this module from the landing side would drag the whole CMS auth stack onto a product page.
 */
const http = createHttpClient(PAGES_BASE_URL, cmsAuth.session);

const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

/** Path segments come from the API's own ids and slugs, but they are still interpolated into a URL. */
const seg = (value: string) => encodeURIComponent(value);

export type ApplicationQuery = {status?: ContentStatus; search?: string; limit?: number; offset?: number};

export const pagesApi = {
  /** Public: what this service is, which tabs a page can have and which link kinds it renders. */
  status: (signal?: AbortSignal) => http.request<PagesStatus>("/", {auth: false, signal}),

  /** The "am I allowed to edit application pages" probe. 403 for an account the service refuses. */
  me: (signal?: AbortSignal) =>
    http.request<{id: string; email: string}>("/admin/me", {signal}),

  /* ── Applications ───────────────────────────────────────────────────────── */

  applications: {
    list: (params: ApplicationQuery = {}, signal?: AbortSignal) =>
      http.request<Application[]>(`/admin/applications${query({...params})}`, {signal}),

    get: (id: string, signal?: AbortSignal) =>
      http.request<Application>(`/admin/applications/${seg(id)}`, {signal}),

    create: (body: NewApplication) =>
      http.request<Application>("/admin/applications", {method: "POST", json: body}),

    /**
     * Omitted fields are left alone and an explicit `null` clears one — but `tabs`, `links` and
     * `translations` are replaced wholesale rather than merged, so a caller sending any of them has
     * to send the complete value.
     */
    update: (id: string, body: ApplicationPayload) =>
      http.request<Application>(`/admin/applications/${seg(id)}`, {method: "PATCH", json: body}),

    remove: (id: string) => http.request<void>(`/admin/applications/${seg(id)}`, {method: "DELETE"}),

    /** One call carries the whole new order; the service takes up to 200 items at a time. */
    reorder: (items: ReorderItem[]) =>
      http.request<Application[]>("/admin/applications/reorder", {method: "POST", json: {items}}),
  },

  /* ── Updates ────────────────────────────────────────────────────────────── */

  updates: {
    list: (applicationId: string, params: {status?: ContentStatus} = {}, signal?: AbortSignal) =>
      http.request<ApplicationUpdate[]>(
        `/admin/applications/${seg(applicationId)}/updates${query({...params})}`,
        {signal},
      ),

    get: (applicationId: string, id: string, signal?: AbortSignal) =>
      http.request<ApplicationUpdate>(`/admin/applications/${seg(applicationId)}/updates/${seg(id)}`, {signal}),

    create: (applicationId: string, body: NewUpdate) =>
      http.request<ApplicationUpdate>(`/admin/applications/${seg(applicationId)}/updates`, {
        method: "POST",
        json: body,
      }),

    update: (applicationId: string, id: string, body: UpdatePayload) =>
      http.request<ApplicationUpdate>(`/admin/applications/${seg(applicationId)}/updates/${seg(id)}`, {
        method: "PATCH",
        json: body,
      }),

    remove: (applicationId: string, id: string) =>
      http.request<void>(`/admin/applications/${seg(applicationId)}/updates/${seg(id)}`, {method: "DELETE"}),
  },

  /* ── Wiki ───────────────────────────────────────────────────────────────── */

  wiki: {
    /** The flat list, in sidebar order, drafts included. This is what the list screen edits. */
    list: (applicationId: string, params: {status?: ContentStatus} = {}, signal?: AbortSignal) =>
      http.request<WikiPage[]>(`/admin/applications/${seg(applicationId)}/wiki${query({...params})}`, {signal}),

    /** The same pages nested and without bodies — a preview of the sidebar a visitor will see. */
    tree: (applicationId: string, signal?: AbortSignal) =>
      http.request<WikiNode[]>(`/admin/applications/${seg(applicationId)}/wiki?tree=true`, {signal}),

    get: (applicationId: string, id: string, signal?: AbortSignal) =>
      http.request<WikiPage>(`/admin/applications/${seg(applicationId)}/wiki/${seg(id)}`, {signal}),

    create: (applicationId: string, body: NewWikiPage) =>
      http.request<WikiPage>(`/admin/applications/${seg(applicationId)}/wiki`, {method: "POST", json: body}),

    update: (applicationId: string, id: string, body: WikiPayload) =>
      http.request<WikiPage>(`/admin/applications/${seg(applicationId)}/wiki/${seg(id)}`, {
        method: "PATCH",
        json: body,
      }),

    remove: (applicationId: string, id: string) =>
      http.request<void>(`/admin/applications/${seg(applicationId)}/wiki/${seg(id)}`, {method: "DELETE"}),

    reorder: (applicationId: string, items: ReorderItem[]) =>
      http.request<WikiPage[]>(`/admin/applications/${seg(applicationId)}/wiki/reorder`, {
        method: "POST",
        json: {items},
      }),
  },
};
