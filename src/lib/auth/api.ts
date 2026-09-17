import {request as webRequest} from "@/lib/auth/client.ts";
import type {RequestFn} from "@/lib/auth/client.ts";
import type {
  AdminAvatarFilters,
  AdminAvatarUpload,
  AdminMe,
  AdminSession,
  AdminSessionFilters,
  AdminUserDetail,
  AdminUserSummary,
  Application,
  ApplicationSecret,
  ApplicationUpdate,
  AuditEntry,
  AuditFilters,
  AvatarUpload,
  CreatedApplication,
  Identity,
  Invitation,
  IssuedSecret,
  MeResponse,
  MyAvatar,
  NewApplication,
  NewInvitation,
  NewPermission,
  NewRole,
  NewSecret,
  Permission,
  PermissionUpdate,
  ProfileUpdate,
  ResendInvitation,
  Role,
  RoleUpdate,
  ServiceStatus,
  Session,
  SessionPruneRequest,
  SessionPruneResult,
  SsoSession,
} from "@/lib/auth/types.ts";

export type AuthApi = ReturnType<typeof createAuthApi>;

const id = (value: string) => encodeURIComponent(value);

/**
 * Builds a query string from a filter object, dropping anything unset.
 *
 * `offset: 0` and `include_revoked: false` are the API's own defaults, so sending them only makes
 * the URL longer — but `limit: 0` is not a filter anyone means, and a falsy check would silently
 * eat a real `0`. Only `undefined`, `null` and the empty string are dropped.
 */
const query = (filters: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

/** Every endpoint of the auth API this interface talks to, grouped the way the API documents them. */
export const createAuthApi = (request: RequestFn) => ({
  /** Public: which providers this deployment actually has configured. */
  status: (signal?: AbortSignal) => request<ServiceStatus>("/", {auth: false, signal}),

  me: (signal?: AbortSignal) => request<MeResponse>("/me", {signal}),
  updateMe: (changes: ProfileUpdate) => request<MeResponse>("/me", {method: "PATCH", json: changes}),
  /** The account's own avatar: published, pending, last refused, and what an upload may be. */
  avatar: (signal?: AbortSignal) => request<MyAvatar>("/me/avatar", {signal}),
  /**
   * Uploads a picture for review. Answers 202 with the parked upload — nothing is published here.
   * The file travels as multipart so the browser writes the boundary itself.
   */
  uploadAvatar: (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return request<AvatarUpload>("/me/avatar", {method: "POST", form: body});
  },
  /** Cancels a pending upload and takes a published avatar off the account. */
  deleteAvatar: () => request<void>("/me/avatar", {method: "DELETE"}),

  identities: (signal?: AbortSignal) => request<Identity[]>("/me/identities", {signal}),
  sessions: (signal?: AbortSignal) => request<Session[]>("/me/sessions", {signal}),
  revokeSession: (sessionId: string) => request<void>(`/me/sessions/${id(sessionId)}`, {method: "DELETE"}),

  /** The browsers signed in to the issuer itself — see `SsoSession`. */
  ssoSessions: (signal?: AbortSignal) => request<SsoSession[]>("/me/sso-sessions", {signal}),
  revokeSsoSession: (sessionId: string) =>
    request<void>(`/me/sso-sessions/${id(sessionId)}`, {method: "DELETE"}),
  /**
   * Bulk close. `dry_run` is what the interface previews with: same answer, nothing revoked. The
   * service never closes the session this call is made from, whatever the rules say.
   */
  pruneSessions: (rules: SessionPruneRequest) =>
    request<SessionPruneResult>("/me/sessions/prune", {method: "POST", json: rules}),
  logout: () => request<void>("/logout", {method: "POST"}),

  admin: {
    /** The console's single gate: 403 here means the account holds no administration permission. */
    me: (signal?: AbortSignal) => request<AdminMe>("/admin/me", {signal}),

    users: (params: {query?: string; limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      request<AdminUserSummary[]>(`/admin/users${query(params)}`, {signal}),
    user: (userId: string, signal?: AbortSignal) => request<AdminUserDetail>(`/admin/users/${id(userId)}`, {signal}),
    updateUser: (userId: string, changes: {status: "active" | "disabled"}) =>
      request<unknown>(`/admin/users/${id(userId)}`, {method: "PATCH", json: changes}),
    userIdentities: (userId: string, signal?: AbortSignal) =>
      request<Identity[]>(`/admin/users/${id(userId)}/identities`, {signal}),
    grantRole: (userId: string, roleId: string) =>
      request<void>(`/admin/users/${id(userId)}/roles`, {method: "POST", json: {role_id: roleId}}),
    revokeRole: (userId: string, roleId: string) =>
      request<void>(`/admin/users/${id(userId)}/roles/${id(roleId)}`, {method: "DELETE"}),

    /**
     * The avatar review queue. `status` defaults to `pending` on the service, and each row carries
     * a `preview` data URL because an upload waiting for a decision has no address of its own.
     */
    avatars: (filters: AdminAvatarFilters = {}, signal?: AbortSignal) =>
      request<AdminAvatarUpload[]>(`/admin/avatars${query(filters)}`, {signal}),
    approveAvatar: (avatarId: string) =>
      request<AdminAvatarUpload>(`/admin/avatars/${id(avatarId)}/approve`, {method: "POST"}),
    rejectAvatar: (avatarId: string, reason?: string | null) =>
      request<AdminAvatarUpload>(`/admin/avatars/${id(avatarId)}/reject`, {
        method: "POST",
        json: {reason: reason?.trim() || null},
      }),

    /** Sessions across every account, or one account's, depending on `user_id`. */
    sessions: (filters: AdminSessionFilters = {}, signal?: AbortSignal) =>
      request<AdminSession[]>(`/admin/sessions${query({...filters, include_revoked: filters.include_revoked})}`, {
        signal,
      }),
    userSessions: (userId: string, filters: Omit<AdminSessionFilters, "user_id"> = {}, signal?: AbortSignal) =>
      request<AdminSession[]>(`/admin/users/${id(userId)}/sessions${query(filters)}`, {signal}),
    revokeUserSession: (sessionId: string) => request<void>(`/admin/sessions/${id(sessionId)}`, {method: "DELETE"}),
    revokeUserSessions: (userId: string) => request<void>(`/admin/users/${id(userId)}/sessions`, {method: "DELETE"}),

    invitations: (signal?: AbortSignal) => request<Invitation[]>("/admin/invitations", {signal}),
    createInvitation: (invitation: NewInvitation) =>
      request<Invitation>("/admin/invitations", {method: "POST", json: invitation}),
    resendInvitation: (invitationId: string, options: ResendInvitation = {}) =>
      request<Invitation>(`/admin/invitations/${id(invitationId)}/resend`, {method: "POST", json: options}),
    revokeInvitation: (invitationId: string) =>
      request<void>(`/admin/invitations/${id(invitationId)}`, {method: "DELETE"}),

    applications: (signal?: AbortSignal) => request<Application[]>("/admin/applications", {signal}),
    createApplication: (application: NewApplication) =>
      request<CreatedApplication>("/admin/applications", {method: "POST", json: application}),
    updateApplication: (clientId: string, changes: ApplicationUpdate) =>
      request<Application>(`/admin/applications/${id(clientId)}`, {method: "PATCH", json: changes}),

    secrets: (clientId: string, signal?: AbortSignal) =>
      request<ApplicationSecret[]>(`/admin/applications/${id(clientId)}/secrets`, {signal}),
    /** The only response that carries a secret in the clear; it cannot be read back afterwards. */
    issueSecret: (clientId: string, options: NewSecret = {}) =>
      request<IssuedSecret>(`/admin/applications/${id(clientId)}/secrets`, {method: "POST", json: options}),
    revokeSecret: (clientId: string, secretId: string) =>
      request<void>(`/admin/applications/${id(clientId)}/secrets/${id(secretId)}`, {method: "DELETE"}),

    roles: (signal?: AbortSignal) => request<Role[]>("/admin/roles", {signal}),
    createRole: (role: NewRole) => request<Role>("/admin/roles", {method: "POST", json: role}),
    updateRole: (roleId: string, changes: RoleUpdate) =>
      request<Role>(`/admin/roles/${id(roleId)}`, {method: "PATCH", json: changes}),
    deleteRole: (roleId: string) => request<void>(`/admin/roles/${id(roleId)}`, {method: "DELETE"}),
    attachPermission: (roleId: string, slug: string) =>
      request<void>(`/admin/roles/${id(roleId)}/permissions`, {method: "POST", json: {permission_slug: slug}}),
    detachPermission: (roleId: string, slug: string) =>
      request<void>(`/admin/roles/${id(roleId)}/permissions/${id(slug)}`, {method: "DELETE"}),

    permissions: (signal?: AbortSignal) => request<Permission[]>("/admin/permissions", {signal}),
    createPermission: (permission: NewPermission) =>
      request<Permission>("/admin/permissions", {method: "POST", json: permission}),
    updatePermission: (permissionId: string, changes: PermissionUpdate) =>
      request<Permission>(`/admin/permissions/${id(permissionId)}`, {method: "PATCH", json: changes}),
    deletePermission: (permissionId: string) =>
      request<void>(`/admin/permissions/${id(permissionId)}`, {method: "DELETE"}),

    audit: (filters: AuditFilters = {}, signal?: AbortSignal) =>
      request<AuditEntry[]>(`/admin/audit${query(filters)}`, {signal}),
    /** The service's own closed set of event names, so a filter cannot offer an impossible value. */
    auditEvents: (signal?: AbortSignal) => request<string[]>("/admin/audit/events", {signal}),
  },
});

/** Bound to the site's own client; other applications get theirs from `createAuthClient`. */
export const authApi = createAuthApi(webRequest);
