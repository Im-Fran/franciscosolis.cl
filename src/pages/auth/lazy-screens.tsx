import {lazy} from "react";

/*
 * The auth screens — the admin console above all — are a good deal of code that most visitors of
 * the site never open, so they are split out of the main bundle and fetched on demand.
 */

export const SignIn = lazy(() => import("@/pages/auth/sign-in.tsx").then((module) => ({default: module.SignIn})));

export const Authorize = lazy(() =>
  import("@/pages/auth/authorize.tsx").then((module) => ({default: module.Authorize})),
);

export const Callback = lazy(() =>
  import("@/pages/auth/callback.tsx").then((module) => ({default: module.Callback})),
);

/*
 * The account is a layout with a section under it, the same shape as the console: the tab column
 * and the shell stay mounted, and each section arrives as its own chunk.
 */
export const Account = lazy(() =>
  import("@/pages/auth/account/account-layout.tsx").then((m) => ({default: m.Account})),
);
export const AccountProfile = lazy(() =>
  import("@/pages/auth/account/profile-form.tsx").then((m) => ({default: m.ProfileSection})),
);
export const AccountSignature = lazy(() =>
  import("@/pages/auth/account/signature/signature-panel.tsx").then((m) => ({default: m.SignatureSection})),
);
export const AccountAccess = lazy(() =>
  import("@/pages/auth/account/access-panel.tsx").then((m) => ({default: m.AccessPanel})),
);
export const AccountIdentities = lazy(() =>
  import("@/pages/auth/account/identities-panel.tsx").then((m) => ({default: m.IdentitiesPanel})),
);
export const AccountSessions = lazy(() =>
  import("@/pages/auth/account/sessions-panel.tsx").then((m) => ({default: m.SessionsPanel})),
);
export const AccountDetails = lazy(() =>
  import("@/pages/auth/account/details-panel.tsx").then((m) => ({default: m.DetailsPanel})),
);

/*
 * The console is one screen per section rather than one screen with tabs, so each section is its
 * own chunk: opening the audit log does not pull in the application editor's forms.
 */
export const AdminLayout = lazy(() =>
  import("@/pages/auth/admin/components/admin-layout.tsx").then((m) => ({default: m.AdminLayout})),
);
export const AdminOverview = lazy(() =>
  import("@/pages/auth/admin/overview.tsx").then((m) => ({default: m.Overview})),
);
export const UsersList = lazy(() =>
  import("@/pages/auth/admin/users/users-list.tsx").then((m) => ({default: m.UsersList})),
);
export const UserDetail = lazy(() =>
  import("@/pages/auth/admin/users/user-detail.tsx").then((m) => ({default: m.UserDetail})),
);
export const SessionsList = lazy(() =>
  import("@/pages/auth/admin/sessions/sessions-list.tsx").then((m) => ({default: m.SessionsList})),
);
export const InvitationsList = lazy(() =>
  import("@/pages/auth/admin/invitations/invitations-list.tsx").then((m) => ({default: m.InvitationsList})),
);
export const ApplicationsList = lazy(() =>
  import("@/pages/auth/admin/applications/applications-list.tsx").then((m) => ({default: m.ApplicationsList})),
);
export const ApplicationEditor = lazy(() =>
  import("@/pages/auth/admin/applications/application-editor.tsx").then((m) => ({default: m.ApplicationEditor})),
);
export const RolesList = lazy(() =>
  import("@/pages/auth/admin/roles/roles-list.tsx").then((m) => ({default: m.RolesList})),
);
export const RoleEditor = lazy(() =>
  import("@/pages/auth/admin/roles/role-editor.tsx").then((m) => ({default: m.RoleEditor})),
);
export const PermissionsList = lazy(() =>
  import("@/pages/auth/admin/permissions/permissions-list.tsx").then((m) => ({default: m.PermissionsList})),
);
export const AuditLog = lazy(() =>
  import("@/pages/auth/admin/audit/audit-log.tsx").then((m) => ({default: m.AuditLog})),
);
