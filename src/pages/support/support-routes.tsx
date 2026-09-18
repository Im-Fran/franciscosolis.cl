import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {AuthProvider} from "@/lib/auth/auth-provider.tsx";
import {RequireAuth} from "@/components/auth/require-auth.tsx";
import {ToastProvider} from "@/lib/admin/toast-provider.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {supportAuth} from "@/lib/support/client.ts";
import {SupportProvider} from "@/lib/support/support-provider.tsx";
import {
  ArticleEditor,
  ArticleList,
  AuditLog,
  Callback,
  CategoryList,
  EmailList,
  Inbox,
  LabelList,
  SignIn,
  SupportLayout,
  TicketDetail,
} from "@/pages/support/lazy-screens.tsx";

/**
 * The support team's console, at `/support`.
 *
 * The same shape as the CMS's: its own `AuthProvider` over the subtree so the session lives in its
 * own storage namespace, `sign-in` and `callback` outside the gate, and then a **pathless** layout
 * route holding everything else — one gate, one provider, one shell for every screen the console
 * grows.
 *
 * It is a different client application from the CMS, which `apps/pages` deliberately is not. The
 * reason is assignment: a ticket goes to a person, and "a person" only means something if there is a
 * defined set of them. The auth service resolves roles per application, so a client id of its own is
 * what produces that set — and it also means a support agent is not automatically able to publish
 * the landing page.
 */
export const supportRoutes: RouteObject = {
  path: "support",
  element: (
    <AuthProvider client={supportAuth}>
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
            <SupportProvider>
              <SupportLayout />
            </SupportProvider>
          </ToastProvider>
        </RequireAuth>
      ),
      children: [
        {index: true, element: <Inbox />},
        {path: "tickets/:id", element: <TicketDetail />},
        {path: "labels", element: <LabelList />},
        /* `help/new` and `help/categories` are literal and must stay ahead of `help/:id`. */
        {path: "help", element: <ArticleList />},
        {path: "help/new", element: <ArticleEditor mode="create" />},
        {path: "help/categories", element: <CategoryList />},
        {path: "help/:id", element: <ArticleEditor mode="edit" />},
        {path: "emails", element: <EmailList />},
        {path: "audit", element: <AuditLog />},
        {path: "*", element: <NotFound />},
      ],
    },
    {path: "*", element: <NotFound />},
  ],
};
