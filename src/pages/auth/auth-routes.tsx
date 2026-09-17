import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {RequireAuth} from "@/components/auth/require-auth.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {
  Account,
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

/** Everything under /auth: sign-in, the OAuth callback and the areas that need a session. */
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
      /* Pathless layout route, so both signed-in screens share one gate. */
      element: (
        <RequireAuth restoringKey="auth:account.restoring">
          <Outlet/>
        </RequireAuth>
      ),
      children: [
        {
          path: "account",
          element: <Account/>,
        },
        {
          /*
           * The console is a layout with a section under it, not a screen with tabs: every record
           * has an address, and `AdminLayout` asks `/admin/me` once for the whole subtree.
           */
          path: "admin",
          element: <AdminLayout/>,
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
      ],
    },
    {
      path: "*",
      element: <NotFound/>,
    },
  ],
};

/**
 * The auth service's hosted sign-in screen, at /apps/auth.
 *
 * Kept apart from `authRoutes` on purpose. Everything under `/auth` belongs to *this site* and
 * signs in under its own client id; this one belongs to the auth service and signs in whichever
 * application parked the request it was handed. It is public and stateless — the handle in the
 * query string is the whole context — so it sits outside both the gate and any `AuthProvider`.
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
