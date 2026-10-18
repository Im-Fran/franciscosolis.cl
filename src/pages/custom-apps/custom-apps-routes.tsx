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
  AlertDetail,
  AlertRules,
  Alerts,
  AppConfig,
  AppCreate,
  AppDiagnostics,
  AppInstallations,
  AppLayout,
  AppList,
  AppMessages,
  AppReleases,
  AppSettings,
  AppStatus,
  AppSummary,
  AppUsage,
  AppWorkLog,
  AuditLog,
  Callback,
  CompanyEditor,
  CompanyList,
  ContactEditor,
  ContactList,
  ContractDetail,
  ContractEditor,
  ContractList,
  CrashDetail,
  CustomAppsLayout,
  InstallationDetail,
  Overview,
  ReleaseDetail,
  SignIn,
  TicketDetail,
  Tickets,
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
 * One app is a layout route of its own (`AppLayout`), unlike a marketplace product: its tabs share
 * one record, a header and a state badge, and each screen fetching the same app would reload the
 * header on every tab change. The remote-operation tabs (config, messages, diagnostics) and the
 * releases tab are routes whatever the app's modules; the tab bar hides the ones that are off, and each screen explains
 * itself if reached anyway.
 *
 * `alerts/:alertId` is a contract rather than a choice: the notification centre links each alert
 * there. Contracts sit beside the apps rather than under one, because a contract belongs to a client
 * and covers several of its apps; its edit screen is a route of its own (`contracts/:id/edit`) so the
 * detail page stays a page to read.
 *
 * `tickets/:ticketId` is a contract in the same way `alerts/:alertId` is: the notification centre
 * links each new ticket and each requester message there. Tickets sit beside the apps rather than
 * under one because the inbox crosses apps, like the alerts.
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
            {path: "config", element: <AppConfig />},
            {path: "messages", element: <AppMessages />},
            {path: "diagnostics", element: <AppDiagnostics />},
            {path: "releases", element: <AppReleases />},
            {path: "work-log", element: <AppWorkLog />},
            {path: "settings", element: <AppSettings />},
          ],
        },
        {path: "contracts", element: <ContractList />},
        {path: "contracts/new", element: <ContractEditor />},
        {path: "contracts/:contractId", element: <ContractDetail />},
        {path: "contracts/:contractId/edit", element: <ContractEditor />},
        {path: "installations/:installationId", element: <InstallationDetail />},
        {path: "crashes/:crashId", element: <CrashDetail />},
        {path: "releases/:releaseId", element: <ReleaseDetail />},
        {path: "tickets", element: <Tickets />},
        {path: "tickets/:ticketId", element: <TicketDetail />},
        /* `rules` is literal and must stay ahead of `:alertId`. */
        {path: "alerts", element: <Alerts />},
        {path: "alerts/rules", element: <AlertRules />},
        {path: "alerts/:alertId", element: <AlertDetail />},
        {path: "audit-log", element: <AuditLog />},
        {path: "*", element: <NotFound />},
      ],
    },
    {path: "*", element: <NotFound />},
  ],
};
