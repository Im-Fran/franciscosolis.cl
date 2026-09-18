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
