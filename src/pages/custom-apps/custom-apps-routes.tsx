import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {RequireAuth} from "@/components/auth/require-auth.tsx";
import {AuthProvider} from "@/lib/auth/auth-provider.tsx";
import {ToastProvider} from "@/lib/admin/toast-provider.tsx";
import {customAppsAuth} from "@/lib/custom-apps/client.ts";
import {CustomAppsProvider} from "@/lib/custom-apps/custom-apps-provider.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {
  AppCreate,
  AppInstallations,
  AppLayout,
  AppList,
  AppSettings,
  AppStatus,
  AppSummary,
  AppUsage,
  AuditLog,
  Callback,
  CompanyEditor,
  CompanyList,
  ContactEditor,
  ContactList,
  CustomAppsLayout,
  InstallationDetail,
  Overview,
  SignIn,
} from "@/pages/custom-apps/lazy-screens.tsx";

/**
 * The custom-apps panel, at `/custom-apps`: the bespoke apps built for clients, who they were built
 * for, where they are installed and what those installations are doing right now.
 *
 * The same shape as the marketplace console: its own `AuthProvider` so the session lives in its own
 * storage namespace, `sign-in` and `callback` outside the gate, and a **pathless** layout route
 * holding everything else — one gate, one access probe, one shell.
 *
 * It is a client application of its own because the service accepts nothing else (see
 * `src/lib/custom-apps/config.ts`).
 *
 * One app is a layout route of its own (`AppLayout`), unlike a marketplace product: its five tabs
 * share one record, a header and a state badge, and five screens each fetching the same app would
 * reload the header on every tab change.
 */
export const customAppsRoutes: RouteObject = {
  path: "custom-apps",
  element: (
    <AuthProvider client={customAppsAuth}>
      <Suspense fallback={<AuthLoading />}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  ),
  children: [
    {path: "sign-in", element: <SignIn />},
    {path: "callback", element: <Callback />},
    {
      element: (
        <RequireAuth restoringKey="admin:common.restoring">
          <ToastProvider>
            <CustomAppsProvider>
              <CustomAppsLayout />
            </CustomAppsProvider>
          </ToastProvider>
        </RequireAuth>
      ),
      children: [
        {index: true, element: <Overview />},
        /* `new` is literal and must stay ahead of each `:id`. */
        {path: "companies", element: <CompanyList />},
        {path: "companies/new", element: <CompanyEditor />},
        {path: "companies/:companyId", element: <CompanyEditor />},
        {path: "contacts", element: <ContactList />},
        {path: "contacts/new", element: <ContactEditor />},
        {path: "contacts/:contactId", element: <ContactEditor />},
        {path: "apps", element: <AppList />},
        {path: "apps/new", element: <AppCreate />},
        {
          path: "apps/:appId",
          element: <AppLayout />,
          children: [
            {index: true, element: <AppSummary />},
            {path: "installations", element: <AppInstallations />},
            {path: "usage", element: <AppUsage />},
            {path: "status", element: <AppStatus />},
            {path: "settings", element: <AppSettings />},
          ],
        },
        {path: "installations/:installationId", element: <InstallationDetail />},
        {path: "audit-log", element: <AuditLog />},
        {path: "*", element: <NotFound />},
      ],
    },
    {path: "*", element: <NotFound />},
  ],
};
