/**
 * Types mirroring the FranciscoSolis Auth API (https://api.franciscosolis.cl/auth/openapi.json).
 *
 * The admin list endpoints only *guarantee* a small set of keys in their schema; the extra fields
 * below are the ones the service sends in practice, so they are typed optional and every view
 * renders them defensively.
 */

/** Envelope every endpoint answers with, except the OAuth token endpoint. */
export type ApiEnvelope<T> = { code: number; data: T };
/**
 * A rejection, in any of the three shapes the service answers with: its own `{ code, error }`, the
 * OAuth endpoints' `{ error, error_description }` (RFC 6749 §5.2, and no `code`), and a schema
 * failure's array of issues. `parseError` reads all three.
 */
export type ApiErrorBody = {
  code?: number;
  error: string | Array<{message?: string} | string>;
  /** The sentence, when the code beside it is a machine token like `invalid_grant`. */
  error_description?: string;
  message?: string;
};

/* ── Service metadata ─────────────────────────────────────────────────────── */

export type AuthProviderName = "magic_link" | "google";

export type AuthProviderInfo = {
  name: AuthProviderName | (string & {});
  display_name: string;
  /** `email` providers are started with a POST, `redirect` ones by navigating away. */
  initiation: "email" | "redirect" | (string & {});
  start_path: string;
  /** False when this deployment has no secrets configured for the provider. */
  available: boolean;
};

export type ServiceStatus = {
  message: string;
  issuer: string;
  providers: AuthProviderInfo[];
};

/* ── Parked authorization requests ────────────────────────────────────────── */

/** One provider as offered for a parked request, with the URL that starts it. */
export type PendingAuthorizationProvider = {
  name: AuthProviderName | (string & {});
  display_name: string;
  /** `email` providers are started by posting an address, `redirect` ones by navigating away. */
  initiation: "email" | "redirect" | (string & {});
  /** Absolute URL on the auth service that resumes this request through the provider. */
  start_url: string;
};

/**
 * A request parked by `GET /oauth/authorize`, as the hosted sign-in screen reads it.
 *
 * It carries only what the browser holding the handle already sent — the client's `state` and
 * `nonce` are deliberately not here.
 */
export type PendingAuthorizationRequest = {
  request: string;
  client_id: string;
  client_name: string;
  scope: string | null;
  login_hint: string | null;
  expires_at: string;
  providers: PendingAuthorizationProvider[];
};

/** What both magic-link endpoints answer with, whether or not an email actually went out. */
export type MagicLinkAccepted = {
  message: string;
  expires_in: number;
};

/* ── Tokens ───────────────────────────────────────────────────────────────── */

/** Flat OAuth 2.0 token response — not wrapped in the `{ code, data }` envelope. */
export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  /** Omitted by a refresh answer that is not rotating the token; the stored one then stands. */
  refresh_token?: string;
  scope: string | null;
  session_id: string;
};

/* ── Account ──────────────────────────────────────────────────────────────── */

export type User = {
  id: string;
  email: string;
  email_verified: boolean;
  name: string | null;
  given_name: string | null;
  family_name: string | null;
  picture: string | null;
  locale: string | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MeResponse = {
  user: User;
  application_id: string;
  session_id: string;
  /** Roles and permissions held for the application the access token was issued to. */
  roles: string[];
  permissions: string[];
};

export type ProfileUpdate = {
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
  locale?: string | null;
};

export type Identity = {
  id: string;
  provider: string;
  email: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type Session = {
  id: string;
  application_id: string;
  provider: string;
  ip: string | null;
  user_agent: string | null;
  /** True for the session the access token in use belongs to. */
  current: boolean;
  revoked_at: string | null;
  last_seen_at: string;
  created_at: string;
};

/* ── Admin ────────────────────────────────────────────────────────────────── */

/**
 * `GET /admin/me`: whether this account belongs in the console at all, asked once above the
 * screens. It is the only admin endpoint that names no permission — it answers 403 for an account
 * holding none of them, which is the single no-access state the whole console is gated on.
 */
export type AdminMe = {
  user: User;
  application_id: string;
  roles: string[];
  permissions: string[];
};

export type AdminUserSummary = {
  id: string;
  email: string;
  name?: string | null;
  status?: string;
  email_verified?: boolean;
  picture?: string | null;
  last_login_at?: string | null;
  created_at?: string;
};

/** Only `user.id` is guaranteed by the schema, so every other field is treated as optional here. */
export type AdminUserDetail = {
  user: Partial<User> & {id: string};
  roles?: Role[];
  identities?: Identity[];
  sessions?: Session[];
};

/** A session as the admin endpoints render it: the account and application resolved server-side. */
export type AdminSession = Session & {
  user_id?: string;
  user_email?: string | null;
  user_name?: string | null;
  user_picture?: string | null;
  application_name?: string | null;
  revoked_reason?: string | null;
};

export type AdminSessionFilters = {
  user_id?: string;
  application_id?: string;
  include_revoked?: boolean;
  limit?: number;
  offset?: number;
};

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked" | (string & {});

export type Invitation = {
  id: string;
  email: string;
  status: InvitationStatus;
  application_id?: string | null;
  role_id?: string | null;
  invited_by?: string | null;
  expires_at?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
  /** Only on the answer to a create or a resend: whether an email actually went out. */
  emailed?: boolean;
};

export type NewInvitation = {
  email: string;
  application_id?: string | null;
  role_id?: string | null;
  expires_in_days?: number;
  send_email?: boolean;
  login_url?: string;
};

export type ResendInvitation = {
  login_url?: string;
  expires_in_days?: number;
};

/**
 * How a client proves who it is at the token endpoint. `none` is a public client: it holds no
 * secret, so PKCE is the only thing binding an authorization code to the process that asked for it.
 */
export type ClientAuthMethod = "none" | "client_secret_post" | "client_secret_basic";

export type GrantType = "authorization_code" | "refresh_token" | "client_credentials";

export const CLIENT_AUTH_METHODS: ClientAuthMethod[] = ["none", "client_secret_post", "client_secret_basic"];
export const GRANT_TYPES: GrantType[] = ["authorization_code", "refresh_token", "client_credentials"];
/** The scopes the service understands. An empty list on an application means "every one of them". */
export const SUPPORTED_SCOPES = ["openid", "profile", "email", "offline_access", "roles", "groups"];

export type Application = {
  client_id: string;
  name: string;
  description?: string | null;
  /** Derived server-side from whether the client holds any secret; not settable on its own. */
  confidential?: boolean;
  token_endpoint_auth_method?: ClientAuthMethod;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  grant_types?: GrantType[];
  /** Empty means the client may ask for every supported scope. */
  scopes?: string[];
  require_pkce?: boolean;
  /** Extra browser origins allowed to call the OAuth endpoints cross-origin. */
  allowed_origins?: string[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type NewApplication = {
  client_id: string;
  name: string;
  description?: string | null;
  redirect_uris: string[];
  post_logout_redirect_uris?: string[];
  token_endpoint_auth_method?: ClientAuthMethod;
  grant_types?: GrantType[];
  scopes?: string[];
  require_pkce?: boolean;
  allowed_origins?: string[];
};

/** The generated secret comes back on creation and is never readable again. */
export type CreatedApplication = Application & {client_secret?: string | null};

export type ApplicationUpdate = Partial<Omit<NewApplication, "client_id">> & {is_active?: boolean};

/**
 * One client secret, as the API describes it: never its value, only enough to tell two apart.
 * `last_used_at` is what says whether an old one is safe to revoke.
 */
export type ApplicationSecret = {
  id: string;
  hint: string;
  label: string | null;
  active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type NewSecret = {
  label?: string | null;
  /** Seconds until the new secret expires on its own. Omitted means it never does. */
  expires_in?: number;
  /** Gives the client's other secrets a deadline instead of cutting them off. */
  rotate?: boolean;
  grace_seconds?: number;
};

/** The one response that carries a secret in the clear. It cannot be read back afterwards. */
export type IssuedSecret = ApplicationSecret & {
  client_id: string;
  client_secret: string;
  retired_secrets?: number;
};

export type Role = {
  id: string;
  slug: string;
  name: string;
  /** Null marks a global role, which applies to every client application. */
  application_id: string | null;
  permissions: string[];
  description?: string | null;
  is_default?: boolean;
};

export type NewRole = {
  slug: string;
  name: string;
  description?: string | null;
  application_id?: string | null;
  is_default?: boolean;
  permissions?: string[];
};

/** The slug and the scope are immutable: they are what grants and issued tokens name a role by. */
export type RoleUpdate = {
  name?: string;
  description?: string | null;
  is_default?: boolean;
  /** Replaces the whole set rather than merging into it. */
  permissions?: string[];
};

export type Permission = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
};

export type NewPermission = {
  slug: string;
  name: string;
  description?: string | null;
};

/** A permission's slug is immutable for the same reason a role's is. */
export type PermissionUpdate = {
  name?: string;
  description?: string | null;
};

/** One entry of the authentication audit trail, with its account and application resolved. */
export type AuditEntry = {
  id: string;
  event: string;
  created_at: string;
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  application_id?: string | null;
  application_name?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditFilters = {
  event?: string;
  user_id?: string;
  application_id?: string;
  /** Inclusive bounds, as ISO instants. */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
