import {lazy} from "react";

/*
 * The CMS is a separate application that happens to be served from this bundle; nobody visiting the
 * portfolio needs its code, so every screen is split out and fetched on demand.
 */

export const SignIn = lazy(() => import("@/pages/cms/sign-in.tsx").then((m) => ({default: m.SignIn})));
export const Callback = lazy(() => import("@/pages/cms/callback.tsx").then((m) => ({default: m.Callback})));
export const Overview = lazy(() => import("@/pages/cms/overview.tsx").then((m) => ({default: m.Overview})));

export const ContentList = lazy(() =>
  import("@/pages/cms/content/content-list.tsx").then((m) => ({default: m.ContentList})),
);
export const ContentEditor = lazy(() =>
  import("@/pages/cms/content/content-editor.tsx").then((m) => ({default: m.ContentEditor})),
);

export const LegalList = lazy(() =>
  import("@/pages/cms/legal/legal-list.tsx").then((m) => ({default: m.LegalList})),
);
export const LegalEditor = lazy(() =>
  import("@/pages/cms/legal/legal-editor.tsx").then((m) => ({default: m.LegalEditor})),
);

export const TemplateList = lazy(() =>
  import("@/pages/cms/email/template-list.tsx").then((m) => ({default: m.TemplateList})),
);
export const TemplateEditor = lazy(() =>
  import("@/pages/cms/email/template-editor.tsx").then((m) => ({default: m.TemplateEditor})),
);
export const EmailList = lazy(() =>
  import("@/pages/cms/email/email-list.tsx").then((m) => ({default: m.EmailList})),
);
export const EmailCompose = lazy(() =>
  import("@/pages/cms/email/email-compose.tsx").then((m) => ({default: m.EmailCompose})),
);
export const EmailDetail = lazy(() =>
  import("@/pages/cms/email/email-detail.tsx").then((m) => ({default: m.EmailDetail})),
);

export const AuditLog = lazy(() =>
  import("@/pages/cms/audit/audit-log.tsx").then((m) => ({default: m.AuditLog})),
);
