import {createHttpClient} from "@/lib/auth/client.ts";
import {cmsAuth} from "@/lib/cms/client.ts";
import {MARKETPLACE_BASE_URL} from "@/lib/marketplace/config.ts";
import type {
  Product,
  ProductPayload,
  ProductRelease,
  ContentStatus,
  DownloadRecord,
  NewProduct,
  NewReleaseFile,
  NewRelease,
  NewWikiPage,
  MarketplaceStatus,
  Purchase,
  RefundReason,
  ReleaseFile,
  ReleaseFilePayload,
  ReorderItem,
  Sale,
  SaleDetail,
  SalesSummary,
  ReleasePayload,
  Voucher,
  WikiNode,
  WikiPage,
  WikiPayload,
} from "@/lib/marketplace/types.ts";
import type {TranslationDraft, TranslationDraftRequest} from "@/lib/prose/types.ts";

/**
 * The editorial client for the Standalone App Pages service.
 *
 * It is a different service than the CMS but the *same session*: these screens live at
 * `/cms/pages`, inside the CMS's `AuthProvider`, and the service accepts the CMS's audience for
 * exactly that reason. Reusing `cmsAuth.session` rather than building a second auth stack is what
 * keeps that true — a client of its own would mint a second token, over a second storage namespace,
 * for a product nobody registered.
 *
 * The public half is in `content.ts` and shares none of this: it is unauthenticated, and importing
 * this module from the landing side would drag the whole CMS auth stack onto a product page.
 */
const http = createHttpClient(MARKETPLACE_BASE_URL, cmsAuth.session);

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

export const marketplaceApi = {
  /** Public: what this service is, which tabs a page can have and which link kinds it renders. */
  status: (signal?: AbortSignal) => http.request<MarketplaceStatus>("/", {auth: false, signal}),

  /** The "am I allowed to edit product pages" probe. 403 for an account the service refuses. */
  me: (signal?: AbortSignal) =>
    http.request<{id: string; email: string}>("/admin/me", {signal}),

  /**
   * A machine-translated draft of one prose field, for the translation dialog on that field.
   *
   * It writes nothing: the draft comes back as a string and is saved, edited or discarded through
   * the ordinary update that saves every other override. A model that failed answers `translation:
   * null` with a 200, so only a transport or authorisation failure rejects here.
   */
  translate: (body: TranslationDraftRequest, signal?: AbortSignal) =>
    http.request<TranslationDraft>("/admin/translate", {method: "POST", json: body, signal}),

  /* ── Products ───────────────────────────────────────────────────────── */

  products: {
    list: (params: ApplicationQuery = {}, signal?: AbortSignal) =>
      http.request<Product[]>(`/admin/products${query({...params})}`, {signal}),

    get: (id: string, signal?: AbortSignal) =>
      http.request<Product>(`/admin/products/${seg(id)}`, {signal}),

    create: (body: NewProduct) =>
      http.request<Product>("/admin/products", {method: "POST", json: body}),

    /**
     * Omitted fields are left alone and an explicit `null` clears one — but `tabs`, `links` and
     * `translations` are replaced wholesale rather than merged, so a caller sending any of them has
     * to send the complete value.
     */
    update: (id: string, body: ProductPayload) =>
      http.request<Product>(`/admin/products/${seg(id)}`, {method: "PATCH", json: body}),

    remove: (id: string) => http.request<void>(`/admin/products/${seg(id)}`, {method: "DELETE"}),

    /** One call carries the whole new order; the service takes up to 200 items at a time. */
    reorder: (items: ReorderItem[]) =>
      http.request<Product[]>("/admin/products/reorder", {method: "POST", json: {items}}),
  },

  /* ── Releases ────────────────────────────────────────────────────────────── */

  releases: {
    list: (productId: string, params: {status?: ContentStatus} = {}, signal?: AbortSignal) =>
      http.request<ProductRelease[]>(
        `/admin/products/${seg(productId)}/releases${query({...params})}`,
        {signal},
      ),

    get: (productId: string, id: string, signal?: AbortSignal) =>
      http.request<ProductRelease>(`/admin/products/${seg(productId)}/releases/${seg(id)}`, {signal}),

    create: (productId: string, body: NewRelease) =>
      http.request<ProductRelease>(`/admin/products/${seg(productId)}/releases`, {
        method: "POST",
        json: body,
      }),

    update: (productId: string, id: string, body: ReleasePayload) =>
      http.request<ProductRelease>(`/admin/products/${seg(productId)}/releases/${seg(id)}`, {
        method: "PATCH",
        json: body,
      }),

    remove: (productId: string, id: string) =>
      http.request<void>(`/admin/products/${seg(productId)}/releases/${seg(id)}`, {method: "DELETE"}),
  },

  /* ── Release files ──────────────────────────────────────────────────────── */

  /**
   * The downloadable builds of a release.
   *
   * Registering a build and uploading its bytes are two calls, because the service takes them as
   * two: a multipart form would mean holding a 90 MB installer in memory to describe it, and
   * replacing the bytes of a build a published release already links to would otherwise mean
   * deleting the row somebody is linking to.
   */
  files: {
    list: (productId: string, releaseId: string, signal?: AbortSignal) =>
      http.request<ReleaseFile[]>(
        `/admin/products/${seg(productId)}/releases/${seg(releaseId)}/files`,
        {signal},
      ),

    create: (productId: string, releaseId: string, body: NewReleaseFile) =>
      http.request<ReleaseFile>(`/admin/products/${seg(productId)}/releases/${seg(releaseId)}/files`, {
        method: "POST",
        json: body,
      }),

    /**
     * Sends the bytes themselves as the request body.
     *
     * The `File` goes up as it is rather than through a `FormData`, so the browser streams it
     * instead of copying it. The declared type travels as a header because the body is the file and
     * has nowhere else to carry it.
     */
    upload: (productId: string, releaseId: string, id: string, file: File) =>
      http.request<ReleaseFile>(
        `/admin/products/${seg(productId)}/releases/${seg(releaseId)}/files/${seg(id)}/content`,
        {
          method: "PUT",
          body: file,
          headers: {"Content-Type": file.type || "product/octet-stream"},
        },
      ),

    update: (productId: string, releaseId: string, id: string, body: ReleaseFilePayload) =>
      http.request<ReleaseFile>(
        `/admin/products/${seg(productId)}/releases/${seg(releaseId)}/files/${seg(id)}`,
        {method: "PATCH", json: body},
      ),

    remove: (productId: string, releaseId: string, id: string) =>
      http.request<void>(
        `/admin/products/${seg(productId)}/releases/${seg(releaseId)}/files/${seg(id)}`,
        {method: "DELETE"},
      ),
  },

  /* ── Payments ───────────────────────────────────────────────────────────── */

  /**
   * The cross-product view: what came in, whatever product it came in for. Read-only, because
   * a total over every payment is the only thing it is for — administering the sales *of one
   * product* is `sales` below, which is where every write lives.
   */
  store: {
    purchases: (
      params: {product_id?: string; status?: string; email?: string; limit?: number; offset?: number} = {},
      signal?: AbortSignal,
    ) => http.request<Purchase[]>(`/admin/purchases${query({...params})}`, {signal}),
  },

  /* ── Sales, per product ─────────────────────────────────────────────── */

  /**
   * One product's sales: the payments MercadoPago took, the ones recorded by hand, their
   * receipts and their refunds.
   *
   * Everything here is nested under the product, exactly as the releases and the wiki are, and
   * for the same reason: it is what stops a sale of one product being read or refunded through
   * another's URL.
   */
  sales: {
    list: (
      productId: string,
      params: {
        status?: string;
        source?: string;
        environment?: string;
        kind?: string;
        email?: string;
        from?: string;
        to?: string;
        limit?: number;
        offset?: number;
      } = {},
      signal?: AbortSignal,
    ) => http.request<Sale[]>(`/admin/products/${seg(productId)}/sales${query({...params})}`, {signal}),

    /**
     * The totals, computed in the database over exactly the rows `list` returns for the same
     * filters — which is the difference between a lifetime figure and the sum of one page.
     */
    summary: (
      productId: string,
      params: {status?: string; source?: string; environment?: string; kind?: string; email?: string; from?: string; to?: string} = {},
      signal?: AbortSignal,
    ) =>
      http.request<SalesSummary>(
        `/admin/products/${seg(productId)}/sales/summary${query({...params})}`,
        {signal},
      ),

    /** One sale in full: the payment, its vouchers and whether it can still be refunded. */
    get: (productId: string, saleId: string, signal?: AbortSignal) =>
      http.request<SaleDetail>(`/admin/products/${seg(productId)}/sales/${seg(saleId)}`, {signal}),

    /**
     * Records a sale taken outside MercadoPago — cash, a transfer, or a copy given away — as an
     * approved payment that entitles its recipient exactly as a paid one does.
     */
    create: (
      productId: string,
      body: {
        email: string;
        source: string;
        kind?: "purchase" | "donation";
        amount: number;
        user_id?: string;
        note?: string;
        reference?: string;
        occurred_at?: string | null;
        locale?: string;
        issue_voucher?: boolean;
        notify?: boolean;
      },
    ) =>
      http.request<{sale: Sale; voucher: Voucher | null}>(`/admin/products/${seg(productId)}/sales`, {
        method: "POST",
        json: body,
      }),

    /**
     * Corrects the address, the account or the note. The amount, the status, the source and the
     * dates are not editable — correcting one of those is a refund and a new sale.
     */
    update: (
      productId: string,
      saleId: string,
      body: {email?: string; user_id?: string; note?: string | null},
    ) =>
      http.request<Sale>(`/admin/products/${seg(productId)}/sales/${seg(saleId)}`, {
        method: "PATCH",
        json: body,
      }),

    /** Gives a sale back, in full or in part, and tells the buyer unless asked not to. */
    refund: (
      productId: string,
      saleId: string,
      body: {reason: RefundReason; amount?: number; notify?: boolean},
    ) =>
      http.request<Sale>(`/admin/products/${seg(productId)}/sales/${seg(saleId)}/refund`, {
        method: "POST",
        json: body,
      }),

    downloads: (productId: string, params: {limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      http.request<DownloadRecord[]>(
        `/admin/products/${seg(productId)}/downloads${query({...params})}`,
        {signal},
      ),
  },

  /* ── Vouchers ───────────────────────────────────────────────────────────── */

  /**
   * The receipts. A voucher is never edited: correcting one means issuing the next, which voids the
   * previous and takes a new number, and that is why there is no `update` here.
   */
  vouchers: {
    list: (
      productId: string,
      params: {status?: string; sale_id?: string; email?: string; limit?: number; offset?: number} = {},
      signal?: AbortSignal,
    ) => http.request<Voucher[]>(`/admin/products/${seg(productId)}/vouchers${query({...params})}`, {signal}),

    get: (productId: string, voucherId: string, signal?: AbortSignal) =>
      http.request<Voucher>(`/admin/products/${seg(productId)}/vouchers/${seg(voucherId)}`, {signal}),

    /** Issues a voucher for a sale, voiding whatever was live for it. */
    issue: (
      productId: string,
      saleId: string,
      body: {email?: string; locale?: string; notify?: boolean} = {},
    ) =>
      http.request<Voucher>(`/admin/products/${seg(productId)}/sales/${seg(saleId)}/vouchers`, {
        method: "POST",
        json: body,
      }),

    /** Emails it again — to the address it was issued to, or elsewhere for this send only. */
    send: (productId: string, voucherId: string, body: {email?: string} = {}) =>
      http.request<Voucher>(`/admin/products/${seg(productId)}/vouchers/${seg(voucherId)}/send`, {
        method: "POST",
        json: body,
      }),

    void: (productId: string, voucherId: string, body: {reason?: string} = {}) =>
      http.request<Voucher>(`/admin/products/${seg(productId)}/vouchers/${seg(voucherId)}/void`, {
        method: "POST",
        json: body,
      }),
  },

  /* ── Wiki ───────────────────────────────────────────────────────────────── */

  wiki: {
    /** The flat list, in sidebar order, drafts included. This is what the list screen edits. */
    list: (productId: string, params: {status?: ContentStatus} = {}, signal?: AbortSignal) =>
      http.request<WikiPage[]>(`/admin/products/${seg(productId)}/wiki${query({...params})}`, {signal}),

    /** The same pages nested and without bodies — a preview of the sidebar a visitor will see. */
    tree: (productId: string, signal?: AbortSignal) =>
      http.request<WikiNode[]>(`/admin/products/${seg(productId)}/wiki?tree=true`, {signal}),

    get: (productId: string, id: string, signal?: AbortSignal) =>
      http.request<WikiPage>(`/admin/products/${seg(productId)}/wiki/${seg(id)}`, {signal}),

    create: (productId: string, body: NewWikiPage) =>
      http.request<WikiPage>(`/admin/products/${seg(productId)}/wiki`, {method: "POST", json: body}),

    update: (productId: string, id: string, body: WikiPayload) =>
      http.request<WikiPage>(`/admin/products/${seg(productId)}/wiki/${seg(id)}`, {
        method: "PATCH",
        json: body,
      }),

    remove: (productId: string, id: string) =>
      http.request<void>(`/admin/products/${seg(productId)}/wiki/${seg(id)}`, {method: "DELETE"}),

    reorder: (productId: string, items: ReorderItem[]) =>
      http.request<WikiPage[]>(`/admin/products/${seg(productId)}/wiki/reorder`, {
        method: "POST",
        json: {items},
      }),
  },
};
