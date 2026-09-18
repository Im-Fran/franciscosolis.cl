import {lazy} from "react";

/** The console's screens, each in its own chunk. Nothing here belongs in the site's main bundle. */
export const SignIn = lazy(() => import("@/pages/support/sign-in.tsx").then((m) => ({default: m.SignIn})));
export const Callback = lazy(() => import("@/pages/support/callback.tsx").then((m) => ({default: m.Callback})));
export const SupportLayout = lazy(() =>
  import("@/pages/support/components/support-layout.tsx").then((m) => ({default: m.SupportLayout})),
);
export const Inbox = lazy(() => import("@/pages/support/inbox.tsx").then((m) => ({default: m.Inbox})));
export const TicketDetail = lazy(() =>
  import("@/pages/support/ticket-detail.tsx").then((m) => ({default: m.TicketDetail})),
);
export const LabelList = lazy(() => import("@/pages/support/label-list.tsx").then((m) => ({default: m.LabelList})));
export const ArticleList = lazy(() =>
  import("@/pages/support/article-list.tsx").then((m) => ({default: m.ArticleList})),
);
export const ArticleEditor = lazy(() =>
  import("@/pages/support/article-editor.tsx").then((m) => ({default: m.ArticleEditor})),
);
export const CategoryList = lazy(() =>
  import("@/pages/support/category-list.tsx").then((m) => ({default: m.CategoryList})),
);
export const EmailList = lazy(() => import("@/pages/support/email-list.tsx").then((m) => ({default: m.EmailList})));
export const AuditLog = lazy(() => import("@/pages/support/audit-log.tsx").then((m) => ({default: m.AuditLog})));
