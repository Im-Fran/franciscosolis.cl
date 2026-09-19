/**
 * Types mirroring the Standalone App Pages API (`/pages` module of
 * https://api.franciscosolis.cl/openapi.json).
 *
 * As in the CMS interface, the list and detail endpoints only *guarantee* a small set of keys in
 * their schema while writing accepts a much wider shape. Everything the schema does not promise is
 * typed optional and every view reads it defensively, so a field the service starts or stops
 * sending never breaks a screen.
 */

/* ── Service metadata ─────────────────────────────────────────────────────── */

/** One of the four tabs a page can be built from, as the service describes it. */
export type TabDefinition = {
  key: string;
  name: string;
  description: string;
  /** `field` for a tab that is one Markdown document, `collection` for one that is a list. */
  source: "field" | "collection" | string;
};

export type PagesStatus = {
  message: string;
  tabs: TabDefinition[];
  link_kinds: string[];
  locales?: string[];
  default_locale?: string;
};

/* ── Links ────────────────────────────────────────────────────────────────── */

/**
 * The link vocabulary is closed because the page renders an icon from `kind` — a free-form string
 * would be a list of icons nobody can finish. `other` is the escape hatch, and it is the one kind
 * that reads as a plain link with whatever label it carries.
 */
export const LINK_KINDS = [
  "website",
  "github",
  "gitlab",
  "app_store",
  "play_store",
  "download",
  "documentation",
  "discord",
  "support",
  "sponsor",
  "other",
] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

export type ApplicationLink = {
  kind: LinkKind | string;
  url: string;
  /** Falls back to the kind's own name when absent. */
  label?: string | null;
};

/** The service refuses more than this on one row; the editor stops offering the button at it. */
export const MAX_LINKS = 12;

/* ── Shared ───────────────────────────────────────────────────────────────── */

export type ContentStatus = "draft" | "published" | "archived";

export const CONTENT_STATUSES: ContentStatus[] = ["draft", "published", "archived"];

/**
 * Per-locale overrides of a row's prose, keyed by locale.
 *
 * The row itself holds the default locale, so this map never contains a key for it — the service
 * rejects one. Which fields are valid depends on what is being translated, which is why this is one
 * loose shape rather than three: an application has `name`/`tagline`/`summary` and the two tab
 * bodies, a release note and a wiki page have `title`/`body`.
 */
export type Translations = Record<string, TranslationFields>;

export type TranslationFields = {
  name?: string | null;
  tagline?: string | null;
  summary?: string | null;
  overview_body?: string | null;
  contact_body?: string | null;
  title?: string | null;
  body?: string | null;
};

/* ── Pricing, payments and downloads ──────────────────────────────────────── */

/**
 * How an application is paid for. Three modes and no more, by the service's design:
 *
 * - `free` — no payments at all.
 * - `donation` — pago opcional: the build is free to take, and the modal offering to pay for it
 *   says so out loud. Declining is an offered choice, never a hidden one.
 * - `paid` — a download needs an approved purchase on the account.
 */
export const PRICING_MODES = ["free", "donation", "paid"] as const;

export type PricingMode = (typeof PRICING_MODES)[number];

/**
 * The pricing of an application, already resolved by the service.
 *
 * Every flag here is derived server-side rather than inferred from `mode` on this side, and that is
 * deliberate: the rule about who sees the payment modal is a product decision, and a second copy of
 * it in the browser is a second place for it to be wrong.
 */
export type Pricing = {
  mode: PricingMode | string;
  currency: string;
  /** What a purchase costs. Only ever set in `paid` mode. */
  price?: number | null;
  /** What the donation modal prefills. Only ever set in `donation` mode. */
  suggested_amount?: number | null;
  /** Smallest amount checkout accepts, so the form can say no before the redirect does. */
  minimum_amount?: number;
  /** Whether the visitor may decline and download anyway. False only in `paid` mode. */
  allows_skip?: boolean;
  /** Whether a download is gated on an approved purchase. True only in `paid` mode. */
  requires_payment?: boolean;
  /** Whether checkout exists at all for this application. */
  accepts_payment?: boolean;
};

/** The payment that entitles an account, as its own buyer reads it back. */
export type Purchase = {
  id: string;
  application_id: string;
  application_slug: string;
  kind: "purchase" | "donation" | string;
  status: string;
  /** Whether this row is what currently entitles the account to a download. */
  active: boolean;
  amount: number;
  currency: string;
  provider?: string;
  payment_id?: string | null;
  reference?: string;
  approved_at?: string | null;
  refunded_at?: string | null;
  charged_back_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Whether *this* caller may download, and what has to be shown first.
 *
 * `must_offer_payment` is the whole point of the endpoint: it is true for every non-payer of a
 * paying application, every time, and the page is not allowed to decide otherwise.
 */
export type ApplicationAccess = {
  pricing: Pricing;
  has_paid: boolean;
  must_offer_payment: boolean;
  can_download: boolean;
  /** Seconds this caller waits before the download starts. Zero once they have paid. */
  cooldown_seconds: number;
  /** Whether the caller was recognised, so the page knows whether to sign them in before checkout. */
  authenticated: boolean;
  purchase?: Pick<Purchase, "id" | "kind" | "amount" | "currency" | "approved_at"> | null;
};

/** One downloadable build attached to a release. The service never hands out a bucket URL. */
export type ReleaseFile = {
  id: string;
  update_id: string;
  filename: string;
  content_type: string;
  size: number;
  checksum?: string | null;
  platform: string;
  label?: string | null;
  position?: number;
  download_count?: number;
  uploaded_at?: string | null;
  /* Editorial only. */
  status?: string;
  has_content?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** The builds of one release, plus whether taking one needs a payment first. */
export type ReleaseFiles = {
  files: ReleaseFile[];
  requires_payment: boolean;
};

/**
 * A minted download link.
 *
 * `available_at` is in the future for a non-payer: the five-second wait is a property of the link
 * itself, enforced by the service, so the page counts down to it rather than pretending to.
 */
export type DownloadTicket = {
  url: string;
  available_at: string;
  expires_at: string;
  cooldown_seconds: number;
  paid: boolean;
};

/** What `POST /applications/:slug/checkout` answers: where to send the browser, and what for. */
export type Checkout = {
  purchase_id: string;
  reference: string;
  amount: number;
  currency: string;
  checkout_url: string;
};

/** One served download, as the account that made it reads it back. */
export type DownloadRecord = {
  id: string;
  file_id: string;
  application_id: string;
  application_slug: string;
  version: string;
  filename: string;
  paid: boolean;
  purchase_id?: string | null;
  created_at: string;
};

/** The build platforms an editor may pick from. The website draws a label and an icon from these. */
export const RELEASE_FILE_PLATFORMS = [
  "any",
  "windows",
  "macos",
  "linux",
  "android",
  "ios",
  "web",
  "server",
] as const;

export type ReleaseFilePlatform = (typeof RELEASE_FILE_PLATFORMS)[number];

/** What `POST /admin/…/files` accepts. The bytes go up separately. */
export type NewReleaseFile = {
  filename: string;
  content_type?: string;
  platform?: ReleaseFilePlatform | string;
  label?: string | null;
  position?: number;
  status?: ContentStatus;
};

export type ReleaseFilePayload = Partial<NewReleaseFile>;

/* ── Applications ─────────────────────────────────────────────────────────── */

/** An application as the editorial API returns it: default locale, raw translation map beside it. */
export type Application = {
  id: string;
  slug: string;
  name: string;
  status: string;
  tabs: string[];
  links: ApplicationLink[];
  locale?: string;
  available_locales?: string[];
  tagline?: string | null;
  summary?: string | null;
  featured?: boolean;
  position?: number;
  banner_image_url?: string | null;
  icon_image_url?: string | null;
  accent_color?: string | null;
  /** Absent from the listing, which leaves both tab bodies out on purpose. */
  overview_body?: string | null;
  contact_body?: string | null;
  /** Derived by the service: a price is only quoted for an application that is currently `paid`. */
  pricing?: Pricing;
  translations?: Translations;
  published_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** What `POST /admin/applications` accepts. Everything but the name is optional. */
export type NewApplication = {
  name: string;
  slug?: string;
  tagline?: string | null;
  summary?: string | null;
  status?: ContentStatus;
  featured?: boolean;
  position?: number;
  banner_image_url?: string | null;
  icon_image_url?: string | null;
  accent_color?: string | null;
  tabs?: string[];
  links?: ApplicationLink[];
  overview_body?: string | null;
  contact_body?: string | null;
  /** `free`, `donation` or `paid`. The row keeps a price through a mode change, on purpose. */
  pricing_mode?: PricingMode;
  /** Price of a `paid` application, in whole pesos. */
  price_amount?: number | null;
  /** What a `donation` application suggests in its modal, in whole pesos. */
  suggested_amount?: number | null;
  translations?: Translations;
};

/** What `PATCH` accepts: the same fields, all optional, with `name` settable rather than required. */
export type ApplicationPayload = Partial<NewApplication>;

export type ReorderItem = {id: string; position: number};

/* ── Updates ──────────────────────────────────────────────────────────────── */

export type ApplicationUpdate = {
  id: string;
  application_id: string;
  version: string;
  title: string;
  status: string;
  links: ApplicationLink[];
  locale?: string;
  available_locales?: string[];
  body?: string | null;
  released_at?: string | null;
  translations?: Translations;
  published_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type NewUpdate = {
  version: string;
  title: string;
  body?: string | null;
  status?: ContentStatus;
  released_at?: string | null;
  links?: ApplicationLink[];
  translations?: Translations;
};

export type UpdatePayload = Partial<NewUpdate>;

/* ── Wiki ─────────────────────────────────────────────────────────────────── */

export type WikiPage = {
  id: string;
  application_id: string;
  slug: string;
  title: string;
  status: string;
  parent_id?: string | null;
  icon?: string | null;
  body?: string | null;
  position?: number;
  locale?: string;
  available_locales?: string[];
  translations?: Translations;
  published_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** A sidebar entry: the same page without its body, plus whatever hangs under it. */
export type WikiNode = Omit<WikiPage, "body"> & {children: WikiNode[]};

export type NewWikiPage = {
  title: string;
  slug?: string;
  body?: string | null;
  parent_id?: string | null;
  icon?: string | null;
  status?: ContentStatus;
  position?: number;
  translations?: Translations;
};

export type WikiPayload = Partial<NewWikiPage>;
