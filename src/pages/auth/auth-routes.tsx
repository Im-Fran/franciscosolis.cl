import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {RequireAuth} from "@/components/auth/require-auth.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {AccountLegacyRedirect} from "@/pages/auth/account/legacy-redirect.tsx";
import {
  Account,
  AccountAccess,
  AccountDetails,
  AccountIdentities,
  AccountProfile,
  AccountSessions,
  AccountSignature,
  AdminLayout,
  AdminOverview,
  ApplicationEditor,
  ApplicationsList,
  AuditLog,
  Authorize,
  Callback,
  InvitationsList,
  PermissionsList,
  RoleEditor,
  RolesList,
  SessionsList,
  SignIn,
  UserDetail,
  UsersList,
} from "@/pages/auth/lazy-screens.tsx";

/**
 * Everything under /auth: the sign-in hand-off, the OAuth callback and the console.
 *
 * The account used to live here too, and no longer does — it answers at `/account` (see
 * `accountRoutes` below). What is left under `/auth` is the plumbing of one identity provider: the
 * screen that starts a hosted sign-in, the path the service is registered to redirect back to, and
 * the console that administers the service itself.
 */
export const authRoutes: RouteObject = {
  path: "auth",
  element: (
    <Suspense fallback={<AuthLoading/>}>
      <Outlet/>
    </Suspense>
  ),
  children: [
    {
      index: true,
      element: <SignIn/>,
    },
    {
      path: "callback",
      element: <Callback/>,
    },
    {
      /*
       * The console is a layout with a section under it, not a screen with tabs: every record
       * has an address, and `AdminLayout` asks `/admin/me` once for the whole subtree.
       */
      path: "admin",
      element: (
        <RequireAuth restoringKey="auth:account.restoring">
          <AdminLayout/>
        </RequireAuth>
      ),
      children: [
        {index: true, element: <AdminOverview/>},
        {path: "users", element: <UsersList/>},
        {path: "users/:id", element: <UserDetail/>},
        {path: "sessions", element: <SessionsList/>},
        {path: "invitations", element: <InvitationsList/>},
        {path: "applications", element: <ApplicationsList/>},
        {path: "applications/new", element: <ApplicationEditor mode="create"/>},
        {path: "applications/:id", element: <ApplicationEditor mode="edit"/>},
        {path: "roles", element: <RolesList/>},
        {path: "roles/new", element: <RoleEditor mode="create"/>},
        {path: "roles/:id", element: <RoleEditor mode="edit"/>},
        {path: "permissions", element: <PermissionsList/>},
        {path: "audit", element: <AuditLog/>},
        {path: "*", element: <NotFound/>},
      ],
    },
    /* The account moved to /account; old links and bookmarks still resolve. */
    {
      path: "account/*",
      element: <AccountLegacyRedirect/>,
    },
    {
      path: "*",
      element: <NotFound/>,
    },
  ],
};

/**
 * Your account, at `/account`.
 *
 * It is a layout with a section under it, for the same reason the console is: a tab somebody lands
 * on, reloads or sends to themselves needs an address of its own.
 *
 * It sits at the top level rather than under `/auth` because that is what it is to a visitor — the
 * page behind their own avatar, reachable from anywhere on this site — while `/auth` is the
 * issuer's plumbing. It is still this site's own client that guards it: the gate and the screens
 * read the `AuthProvider` mounted over the whole application.
 */
export const accountRoutes: RouteObject = {
  path: "account",
  element: (
    <Suspense fallback={<AuthLoading/>}>
      <RequireAuth restoringKey="auth:account.restoring">
        <Outlet/>
      </RequireAuth>
    </Suspense>
  ),
  children: [
    {
      element: <Account/>,
      children: [
        {index: true, element: <AccountProfile/>},
        {path: "signature", element: <AccountSignature/>},
        {path: "access", element: <AccountAccess/>},
        {path: "identities", element: <AccountIdentities/>},
        {path: "sessions", element: <AccountSessions/>},
        {path: "details", element: <AccountDetails/>},
      ],
    },
    {path: "*", element: <NotFound/>},
  ],
};

/**
 * The auth service's hosted sign-in screen, at /apps/auth.
 *
 * Kept apart from `authRoutes` on purpose. `/auth` is *this site* asking for a session of its
 * own: it starts an authorization code request under its own client id and waits at its callback.
 * This screen belongs to the auth service and signs in whichever application parked the request it
 * was handed — this site among them, now that `/auth` goes through it like everyone else. It is
 * public and stateless (the handle in the query string is the whole context), so it sits outside
 * both the gate and any `AuthProvider`.
 */
export const authorizeRoutes: RouteObject = {
  path: "apps/auth",
  element: (
    <Suspense fallback={<AuthLoading/>}>
      <Outlet/>
    </Suspense>
  ),
  children: [
    {
      index: true,
      element: <Authorize/>,
    },
    {
      path: "*",
      element: <NotFound/>,
    },
  ],
};
