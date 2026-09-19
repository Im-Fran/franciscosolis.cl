/**
 * Types mirroring the marketplace API (`/marketplace` module of
 * https://api.franciscosolis.cl/openapi.json).
 *
 * As in the CMS interface, the list and detail endpoints only *guarantee* a small set of keys in
 * their schema while writing accepts a much wider shape. Everything the schema does not promise is
 * typed optional and every view reads it defensively, so a field the service starts or stops
 * sending never breaks a screen.
 */

/* ── Service metadata ─────────────────────────────────────────────────────── */

/** One of the tabs a page can be built from, as the service describes it. */
export type TabDefinition = {
  key: string;
  name: string;
  description: string;
  /** `field` for a tab that is one Markdown document, `collection` for one that is a list. */
  source: "field" | "collection" | string;
};

/** A key with a name beside it: how the service hands over every closed vocabulary it owns. */
export type VocabularyEntry = {
  key: string;
  name: string;
  description?: string;
};

/**
 * What the service says about machine-translated drafts.
 *
 * Read rather than assumed for the same reason the locale list is: whether `POST /admin/translate`
 * is offered at all, and how long a field it will accept, is the Worker's decision. A status call
 * that failed leaves it absent, and the editor simply does not offer the button.
 */
export type TranslationSupport = {
  ai: boolean;
  max_source_chars: number;
};

export type MarketplaceStatus = {
  message: string;
  tabs: TabDefinition[];
  link_kinds: string[];
  /** The four release lines, ordered by how finished they are. */
  channels?: VocabularyEntry[];
  /** What a product can be filed under. `null` on the row means uncategorised, not "other". */
  categories?: VocabularyEntry[];
  /** The kinds of thing a release can declare compatibility with. */
  compatibility_kinds?: VocabularyEntry[];
  pricing_modes?: string[];
  locales?: string[];
  default_locale?: string;
  translation?: TranslationSupport;
};

/* ── Release channels ─────────────────────────────────────────────────────── */

/**
 * How finished a release is, which is a different question from whether anybody may see it.
 *
 * `draft`/`published` decides visibility; the channel decides how much to trust what is visible.
 * Both exist because a published nightly is a real thing you may hand somebody, as long as it is
 * labelled. The order here is the order the service defines and the order they are offered in.
 */
export const RELEASE_CHANNELS = ["nightly", "beta", "rc", "release"] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

/** The line a product's public feed shows when nothing asks for more. */
export const STABLE_CHANNEL: ReleaseChannel = "release";

/**
 * The three lines that are not the stable one.
 *
 * Worth naming rather than deriving at each call site: it is what "pre-release" means in the
 * download gate, in the channel picker's grouping and in the supporters-only notice, and three
 * places computing the same filter is three places for it to disagree.
 */
export const PRE_RELEASE_CHANNELS: ReleaseChannel[] = ["nightly", "beta", "rc"];

export const isPreRelease = (channel: string): boolean =>
  (PRE_RELEASE_CHANNELS as string[]).includes(channel);

/** The extra value `?channel=` takes: every line at once, rather than one of them. */
export const ALL_CHANNELS = "all";

/** How many published releases each line holds. Absent lines are simply empty. */
export type ChannelCounts = Partial<Record<ReleaseChannel | string, number>>;

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

export type ProductLink = {
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
 * loose shape rather than three: a product has `name`/`tagline`/`summary` and the two tab
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
 * How a product is paid for. Three modes and no more, by the service's design:
 *
 * - `free` — no payments at all.
 * - `donation` — pago opcional: the build is free to take, and the modal offering to pay for it
 *   says so out loud. Declining is an offered choice, never a hidden one.
 * - `paid` — a download needs an approved purchase on the account.
 */
export const PRICING_MODES = ["free", "donation", "paid"] as const;

export type PricingMode = (typeof PRICING_MODES)[number];

/**
 * The pricing of a product, already resolved by the service.
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
  /** Whether checkout exists at all for this product. */
  accepts_payment?: boolean;
};

/** The payment that entitles an account, as its own buyer reads it back. */
export type Purchase = {
  id: string;
  product_id: string;
  product_slug: string;
  kind: "purchase" | "donation" | string;
  status: string;
  /** Whether this row is what currently entitles the account to a download. */
  active: boolean;
  amount: number;
  currency: string;
  provider?: string;
  /** How the money arrived: the provider, or the channel an editor recorded by hand. */
  source?: SaleSource | string;
  /** What went back, when something did. */
  refunded_amount?: number | null;
  payment_id?: string | null;
  reference?: string;
  approved_at?: string | null;
  refunded_at?: string | null;
  charged_back_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * How the money reached us, as the service records it.
 *
 * `mercadopago` is the only one it can produce by itself; the rest are what an editor records after
 * taking money outside the provider. That is why the picker in the sales screen offers the other
 * four and not this one — a row claiming MercadoPago took money it has no record of would be
 * indistinguishable from a real payment.
 */
export const SALE_SOURCES = ["mercadopago", "cash", "bank_transfer", "gift", "other"] as const;
export type SaleSource = (typeof SALE_SOURCES)[number];

/** The four an editor may pick. Mirrors `MANUAL_SALE_SOURCES` in the service. */
export const MANUAL_SALE_SOURCES = ["cash", "bank_transfer", "gift", "other"] as const;

/** Which MercadoPago account a sale was taken against. A badge, and a refund precondition. */
export const PAYMENT_ENVIRONMENTS = ["live", "sandbox"] as const;
export type PaymentEnvironment = (typeof PAYMENT_ENVIRONMENTS)[number];

/**
 * Why a payment was given back.
 *
 * `withdrawal` is the Chilean consumer statute's *derecho a retracto* — a right the buyer holds
 * unconditionally for ten days — and is deliberately not a synonym for the rest.
 */
export const REFUND_REASONS = ["withdrawal", "duplicate", "not_delivered", "goodwill", "fraud", "other"] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const PURCHASE_STATUSES = [
  "pending",
  "in_process",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
] as const;

/** The statutory withdrawal window as the service reports it on every sale. */
export type Withdrawal = {
  /** When the right runs out, or null for a sale nobody paid. */
  deadline: string | null;
  /** Rounded up, so the last partial day reads as one rather than zero. */
  days_left: number | null;
  within_period: boolean;
};

/**
 * One sale as the editor sees it: the payment, who it belongs to, and whether it can still be
 * given back.
 *
 * The same row the buyer reads back as a `Purchase`, plus the three things that are ours — which
 * MercadoPago account took it, the note an editor wrote *about* the sale rather than to the buyer,
 * and the withdrawal window, which is the answer to "may I still refund this".
 */
export type Sale = Purchase & {
  user_id?: string;
  /** Whether the sale is tied to an SSO account, or so far only to an address. */
  linked_to_account?: boolean;
  email: string;
  environment?: PaymentEnvironment | string;
  preference_id?: string | null;
  refund_reason?: RefundReason | string | null;
  refunded_by?: string | null;
  refund_id?: string | null;
  note?: string | null;
  created_by?: string | null;
  withdrawal: Withdrawal;
  metadata?: Record<string, unknown> | null;
};

/** A count and a sum, for one bucket of a summary. Always present, at zero when empty. */
export type SalesBucket = {count: number; total: number};

/**
 * The totals a sales screen opens with, over exactly the rows the listing beside it shows.
 *
 * Three figures rather than one, because the question has three honest answers and quoting the
 * wrong one counts a refund as income: `gross` is what ever settled, `returned` is what went back
 * out, `net` is the difference.
 */
export type SalesSummary = {
  currency: string;
  /** Which account the *service* is currently configured for, so the screen can badge itself. */
  environment: PaymentEnvironment | string;
  count: number;
  active_count: number;
  gross: number;
  returned: number;
  net: number;
  buyers: number;
  by_status: Record<string, SalesBucket>;
  by_source: Record<string, SalesBucket>;
  first_sale_at: string | null;
  last_sale_at: string | null;
};

/**
 * A voucher: the receipt for a sale, as the buyer was sent it.
 *
 * It is a document rather than a view of the sale — everything it prints was copied onto it when it
 * was issued — and it is never edited. Correcting one is a re-issue, which voids the previous and
 * allocates a new number.
 */
export type Voucher = {
  id: string;
  number: string;
  purchase_id: string;
  product_id?: string;
  product_slug: string;
  product_name: string;
  kind: string;
  amount: number;
  currency: string;
  source: SaleSource | string;
  status: "issued" | "void" | string;
  locale: string;
  issued_at: string;
  /* Editorial only. */
  email?: string;
  issued_by?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  sent_count?: number;
  last_sent_at?: string | null;
  last_sent_to?: string | null;
};

/** One sale in full, as `GET /admin/products/:id/sales/:saleId` answers it. */
export type SaleDetail = {
  sale: Sale;
  vouchers: Voucher[];
  refund: {
    refundable: boolean;
    /** Which rule refused it: the status, or the environment it was taken in. */
    reason: "status" | "environment" | null;
    withdrawal_days: number;
    currency: string;
  };
};

/**
 * Whether *this* caller may download, and what has to be shown first.
 *
 * `must_offer_payment` is the whole point of the endpoint: it is true for every non-payer of a
 * paying product, every time, and the page is not allowed to decide otherwise.
 */
export type ProductAccess = {
  pricing: Pricing;
  has_paid: boolean;
  must_offer_payment: boolean;
  can_download: boolean;
  /**
   * *Why* a download is refused, from a closed set, so the modal can be worded without parsing a
   * sentence. `paid` is "this product costs money"; `pre_release` is "this *line* costs money",
   * which is the one a `donation` product uses to reserve its nightlies for supporters.
   */
  gate: AccessGate | string;
  /** The channel the answer is about, or null when asked without a release in hand. */
  channel?: ReleaseChannel | string | null;
  /** Seconds this caller waits before the download starts. Zero once they have paid. */
  cooldown_seconds: number;
  /** Whether the caller was recognised, so the page knows whether to sign them in before checkout. */
  authenticated: boolean;
  purchase?: Pick<Purchase, "id" | "kind" | "amount" | "currency" | "approved_at"> | null;
};

export const ACCESS_GATES = ["none", "paid", "pre_release"] as const;

export type AccessGate = (typeof ACCESS_GATES)[number];

/** One downloadable build attached to a release. The service never hands out a bucket URL. */
export type ReleaseFile = {
  id: string;
  release_id: string;
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
  /**
   * Whether *this line* is the one reserved for supporters.
   *
   * The listing itself is public on every channel, deliberately: a visitor can always read what is
   * in tonight's build, and what a pre-release may cost them is the download. Hiding the file list
   * would remove the very incentive the gate exists to create.
   */
  channel_requires_purchase: boolean;
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

/** What `POST /products/:slug/checkout` answers: where to send the browser, and what for. */
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
  product_id: string;
  product_slug: string;
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

/* ── Products ─────────────────────────────────────────────────────────── */

/** A product as the editorial API returns it: default locale, raw translation map beside it. */
export type Product = {
  id: string;
  slug: string;
  name: string;
  status: string;
  tabs: string[];
  links: ProductLink[];
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
  /** Derived by the service: a price is only quoted for a product that is currently `paid`. */
  pricing?: Pricing;
  /**
   * What this product is filed under, resolved to a key and a name, or `null` for uncategorised.
   *
   * Null rather than an `other` key on purpose: "nobody has filed this yet" and "this genuinely
   * belongs in the miscellaneous bucket" are different facts, and a listing that renders the first
   * as the second quietly claims an editorial decision that was never made.
   */
  category?: VocabularyEntry | null;
  /** Totals, carried on the row so a listing card can show them without a second call. */
  view_count?: number;
  download_count?: number;
  translations?: Translations;
  published_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** What `POST /admin/products` accepts. Everything but the name is optional. */
export type NewProduct = {
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
  links?: ProductLink[];
  overview_body?: string | null;
  contact_body?: string | null;
  /** `free`, `donation` or `paid`. The row keeps a price through a mode change, on purpose. */
  pricing_mode?: PricingMode;
  /** Price of a `paid` product, in whole pesos. */
  price_amount?: number | null;
  /** What a `donation` product suggests in its modal, in whole pesos. */
  suggested_amount?: number | null;
  /** The category key, or `null` to file it under nothing. */
  category?: string | null;
  /**
   * Whether the pre-release lines are reserved for people who paid.
   *
   * Only meaningful on a `donation` product: on a `paid` one a non-payer cannot download anything
   * anyway, and on a free one there is nobody who paid. The service nulls it out in `free` mode.
   */
  pre_release_requires_purchase?: boolean;
  translations?: Translations;
};

/** What `PATCH` accepts: the same fields, all optional, with `name` settable rather than required. */
export type ProductPayload = Partial<NewProduct>;

export type ReorderItem = {id: string; position: number};

/* ── Releases ──────────────────────────────────────────────────────────────── */

export type ProductRelease = {
  id: string;
  product_id: string;
  version: string;
  /**
   * Which line this release is on. Part of its identity, not a label beside it: the service keys a
   * release on `(product, channel, version)`, so the same `1.4.0` can exist as an `rc` and later as
   * a `release`, and the two are different rows with different notes and different builds.
   */
  channel: ReleaseChannel | string;
  title: string;
  status: string;
  links: ProductLink[];
  /**
   * Whether publishing this release restarted the rating.
   *
   * It deletes nothing — every earlier review is still stored and still readable — so this reads as
   * "the average you see starts here", never as "the old reviews are gone".
   */
  resets_rating?: boolean;
  locale?: string;
  available_locales?: string[];
  body?: string | null;
  released_at?: string | null;
  /** Totals for this release alone. The product's own counters are the sum across its releases. */
  stats?: ReleaseStats;
  /** This release's own compatibility list, ordered. Absent from the feed, present on the detail. */
  compatibility?: CompatibilityEntry[];
  translations?: Translations;
  published_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ReleaseStats = {
  view_count: number;
  download_count: number;
};

export type NewRelease = {
  version: string;
  title: string;
  /** Defaults to the stable line. Part of the version key, so changing it moves the release. */
  channel?: ReleaseChannel | string;
  /** Whether publishing this release restarts the rating window. Deletes nothing. */
  resets_rating?: boolean;
  body?: string | null;
  status?: ContentStatus;
  released_at?: string | null;
  links?: ProductLink[];
  translations?: Translations;
};

export type ReleasePayload = Partial<NewRelease>;

/* ── Compatibility ────────────────────────────────────────────────────────── */

/**
 * What a release runs on, declared per release and never per product.
 *
 * Per release because a release is exactly where support is added and dropped: a version that
 * starts requiring Java 21, or stops building for Intel Macs, is the event the list is about. A
 * product-wide list would have to be either the intersection of every version's — useless — or the
 * newest one's, pretending older downloads were never compatible with anything else.
 */
export const COMPATIBILITY_KINDS = [
  "os",
  "runtime",
  "platform",
  "dependency",
  "hardware",
  "architecture",
  "other",
] as const;

export type CompatibilityKind = (typeof COMPATIBILITY_KINDS)[number];

export type CompatibilityEntry = {
  id: string;
  kind: CompatibilityKind | string;
  /** What it runs on: `macOS`, `Java`, `PostgreSQL`. */
  name: string;
  /**
   * The version range, as free text.
   *
   * Free text for the same reason a version label is: `14+`, `>=17 <22`, `2019 or later` and
   * `only on Apple Silicon` are all things an author needs to be able to say, and a structured
   * range would refuse three of them.
   */
  constraint?: string | null;
  /** Something it *can* use rather than something it needs. Rendered as a qualifier, not a row. */
  optional?: boolean;
  position?: number;
};

export type NewCompatibilityEntry = {
  kind: CompatibilityKind | string;
  name: string;
  constraint?: string | null;
  optional?: boolean;
  position?: number;
};

export type CompatibilityPayload = Partial<NewCompatibilityEntry>;

/* ── The Overview sidebar ─────────────────────────────────────────────────── */

/**
 * What `GET /products/:slug/overview` answers: the panel beside the Overview document.
 *
 * It is one call rather than five because it is one panel: the figures in it are read together and
 * would otherwise be five requests racing to fill one box. It carries no per-caller anything, which
 * is what lets the service cache it for everybody.
 */
export type ProductOverview = {
  product: Pick<Product, "id" | "slug" | "name" | "tagline" | "icon_image_url" | "accent_color"> & {
    category?: VocabularyEntry | null;
  };
  pricing: Pricing;
  stats: ProductStats;
  rating: RatingSummary;
  /** The newest published release on the stable line, or null when there is none. */
  latest_version: LatestVersion | null;
  /** How many published releases each line holds, for the channel picker's counts. */
  channels?: ChannelCounts;
};

export type ProductStats = {
  /** The headline number. Downloads, not purchases — that is the figure people compare. */
  download_count: number;
  /**
   * Approved purchases, or `null` for a product that never took a payment.
   *
   * Null rather than zero: "0 purchases" is not a number anybody asked about on a free product,
   * and rendering it puts a zero next to something that was never for sale.
   */
  purchase_count: number | null;
  view_count: number;
  first_released_at: string | null;
  last_released_at: string | null;
};

/**
 * The stars, as the current window computes them.
 *
 * `average` is `null` — never `0` — when nothing counts toward it, and the distinction matters more
 * here than anywhere else on the page: a null rendered as zero is one empty star on a listing card,
 * which reads as "everybody hated it" rather than "nobody has said yet".
 */
export type RatingSummary = {
  average: number | null;
  /** Reviews the current average is over. */
  count: number;
  /** When the current window opened, if a release restarted it. */
  reset_at?: string | null;
};

/** The newest release, as the sidebar shows it: the version, its figures and what it runs on. */
export type LatestVersion = {
  id: string;
  version: string;
  channel: ReleaseChannel | string;
  title: string;
  released_at?: string | null;
  published_at?: string | null;
  resets_rating?: boolean;
  download_count?: number;
  view_count?: number;
  /**
   * Approved purchases *since this release was published* — "bought while this version was
   * current".
   *
   * An approximation, and labelled as one wherever it is drawn: a purchase entitles the whole
   * product and never names a release, so there is no exact answer to "how many bought this
   * version" and the screen must not imply there is.
   */
  purchase_count?: number | null;
  rating?: RatingSummary;
  compatibility?: CompatibilityEntry[];
  links?: ProductLink[];
  locale?: string;
  available_locales?: string[];
};

/* ── One release in full ──────────────────────────────────────────────────── */

/**
 * What `GET /products/:slug/releases/:channel/:version` answers.
 *
 * Deliberately carries **no** per-caller access block: it is cacheable, and a shared cache keying
 * only on the URL would otherwise hand one buyer's `can_download: true` to everybody. The
 * per-person half is `GET /products/:slug/access?channel=…`, which is `no-store`.
 */
export type ReleaseDetail = ProductRelease & {
  stats: ReleaseStats;
  compatibility: CompatibilityEntry[];
  files: ReleaseFile[];
  /** Whether taking a build of this product needs a payment at all. */
  requires_payment: boolean;
  /** Whether *this line* is the one reserved for supporters. A fact about the release, not the caller. */
  channel_requires_purchase: boolean;
};

/* ── Reviews ──────────────────────────────────────────────────────────────── */

/** The lowest and highest a review may score. Written once; the form and the stars both read it. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

export type Review = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  /** Who wrote it. Never an address — the service does not serialize one. */
  author: {id: string; name: string};
  /** The version it was written against, or null once that release was deleted. */
  release: {id: string; version: string; channel: ReleaseChannel | string} | null;
  /**
   * Whether this review is inside the current rating window.
   *
   * A reset does not hide anything: an older review stays visible and stays readable, and this flag
   * is what lets the list say "written before the rating was restarted" rather than silently
   * showing a review that does not add up to the average above it.
   */
  counts_toward_rating: boolean;
  edited?: boolean;
  /** The owner's public answer. One per review, and only the owner may write it. */
  reply?: ReviewReply | null;
  created_at: string;
  updated_at?: string;
};

export type ReviewReply = {
  body: string;
  author_name: string;
  created_at: string;
  updated_at?: string | null;
};

/**
 * The summary above the list: the stars, the histogram and where the window opened.
 *
 * `count` and `total` are different questions and both are shown: `count` is what the average is
 * over, `total` is every visible review including the ones from before a reset. Quoting the second
 * as the first would put a four-year-old average on a product that restarted last week.
 */
export type ReviewsSummary = {
  average: number | null;
  count: number;
  total: number;
  reset_at?: string | null;
  distribution: Record<string, number>;
};

export type ReviewsPage = {
  summary: ReviewsSummary;
  reviews: Review[];
  pagination: {limit: number; offset: number; total: number};
};

/**
 * Why this caller may or may not write a review, from a closed set.
 *
 * Closed so the empty state can be worded properly rather than by printing a sentence the service
 * wrote: "sign in to review" and "you have to have downloaded it first" are different invitations,
 * and only one of them is worth showing a button for.
 */
export const REVIEW_BLOCK_REASONS = ["not_authenticated", "not_obtained", "no_release"] as const;

export type ReviewBlockReason = (typeof REVIEW_BLOCK_REASONS)[number];

export type ReviewEligibility = {
  can_review: boolean;
  reason?: ReviewBlockReason | string | null;
  /** How they obtained it: bought it, or downloaded it. */
  via?: "purchase" | "download" | null;
  /** The release a new review would be anchored to. */
  anchor?: {id: string; version: string; channel: ReleaseChannel | string} | null;
};

/** What `GET /products/:slug/reviews/me` answers. */
export type MyReview = {
  review: Review | null;
  eligibility: ReviewEligibility;
};

/** What `PUT /products/:slug/reviews` takes. It creates or replaces; there is no separate edit. */
export type ReviewPayload = {
  rating: number;
  title?: string | null;
  body?: string | null;
};

/** Why a reader flagged a review. Closed, so the queue can be grouped by it. */
export const REVIEW_REPORT_REASONS = ["spam", "abuse", "off_topic", "personal_info", "other"] as const;

export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number];

/* ── Wiki ─────────────────────────────────────────────────────────────────── */

export type WikiPage = {
  id: string;
  product_id: string;
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
