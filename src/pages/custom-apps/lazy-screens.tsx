import {lazy} from "react";

/*
 * Every panel screen, split out of the main bundle — the same reasoning as the other consoles: a
 * visitor reading the landing page has no use for a CRM, a telemetry chart or a heatmap. The layout
 * is in here too, because the shell, its navigation and the no-access screen are panel furniture.
 */

export const CustomAppsLayout = lazy(() =>
  import("@/pages/custom-apps/components/custom-apps-layout.tsx").then((m) => ({default: m.CustomAppsLayout})),
);
export const AppLayout = lazy(() =>
  import("@/pages/custom-apps/components/app-layout.tsx").then((m) => ({default: m.AppLayout})),
);

export const SignIn = lazy(() => import("@/pages/custom-apps/sign-in.tsx").then((m) => ({default: m.SignIn})));
export const Callback = lazy(() => import("@/pages/custom-apps/callback.tsx").then((m) => ({default: m.Callback})));

export const Overview = lazy(() => import("@/pages/custom-apps/overview.tsx").then((m) => ({default: m.Overview})));

export const CompanyList = lazy(() =>
  import("@/pages/custom-apps/company-list.tsx").then((m) => ({default: m.CompanyList})),
);
export const CompanyEditor = lazy(() =>
  import("@/pages/custom-apps/company-editor.tsx").then((m) => ({default: m.CompanyEditor})),
);
export const ContactList = lazy(() =>
  import("@/pages/custom-apps/contact-list.tsx").then((m) => ({default: m.ContactList})),
);
export const ContactEditor = lazy(() =>
  import("@/pages/custom-apps/contact-editor.tsx").then((m) => ({default: m.ContactEditor})),
);

export const AppList = lazy(() => import("@/pages/custom-apps/app-list.tsx").then((m) => ({default: m.AppList})));
export const AppCreate = lazy(() => import("@/pages/custom-apps/app-create.tsx").then((m) => ({default: m.AppCreate})));
export const AppSummary = lazy(() =>
  import("@/pages/custom-apps/app-summary.tsx").then((m) => ({default: m.AppSummary})),
);
export const AppInstallations = lazy(() =>
  import("@/pages/custom-apps/app-installations.tsx").then((m) => ({default: m.AppInstallations})),
);
export const AppUsage = lazy(() => import("@/pages/custom-apps/app-usage.tsx").then((m) => ({default: m.AppUsage})));
export const AppStatus = lazy(() => import("@/pages/custom-apps/app-status.tsx").then((m) => ({default: m.AppStatus})));
export const AppSettings = lazy(() =>
  import("@/pages/custom-apps/app-settings.tsx").then((m) => ({default: m.AppSettings})),
);
export const AppConfig = lazy(() => import("@/pages/custom-apps/app-config.tsx").then((m) => ({default: m.AppConfig})));
export const AppMessages = lazy(() =>
  import("@/pages/custom-apps/app-messages.tsx").then((m) => ({default: m.AppMessages})),
);
export const AppDiagnostics = lazy(() =>
  import("@/pages/custom-apps/app-diagnostics.tsx").then((m) => ({default: m.AppDiagnostics})),
);
export const CrashDetail = lazy(() =>
  import("@/pages/custom-apps/crash-detail.tsx").then((m) => ({default: m.CrashDetail})),
);

export const Alerts = lazy(() => import("@/pages/custom-apps/alerts.tsx").then((m) => ({default: m.Alerts})));
export const AlertRules = lazy(() =>
  import("@/pages/custom-apps/alert-rules.tsx").then((m) => ({default: m.AlertRules})),
);
export const AlertDetail = lazy(() =>
  import("@/pages/custom-apps/alert-detail.tsx").then((m) => ({default: m.AlertDetail})),
);

export const InstallationDetail = lazy(() =>
  import("@/pages/custom-apps/installation-detail.tsx").then((m) => ({default: m.InstallationDetail})),
);
export const AuditLog = lazy(() => import("@/pages/custom-apps/audit-log.tsx").then((m) => ({default: m.AuditLog})));
