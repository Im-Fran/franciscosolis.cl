import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {RequireAuth} from "@/components/auth/require-auth.tsx";
import {AuthProvider} from "@/lib/auth/auth-provider.tsx";
import {cmsAuth} from "@/lib/cms/client.ts";
import {CmsProvider} from "@/lib/cms/cms-provider.tsx";
import {ToastProvider} from "@/lib/admin/toast-provider.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {CmsLayout} from "@/pages/cms/components/cms-layout.tsx";
import {ContentRedirect} from "@/pages/cms/components/content-redirect.tsx";
import {
  AuditLog,
  Callback,
  ContentEditor,
  ContentList,
  EmailCompose,
  EmailDetail,
  EmailList,
  LegalEditor,
  LegalList,
  Overview,
  SignIn,
  TemplateEditor,
  TemplateList,
} from "@/pages/cms/lazy-screens.tsx";

/**
 * Everything under /cms.
 *
 * The whole subtree gets its own `AuthProvider`: the CMS signs in as `franciscosolis-cms`, keeps
 * its session apart from the site's and, being nested, is what `useAuth()` resolves to in here.
 * Inside the gate, `CmsProvider` answers the second question — whether this account is admitted —
 * once for every screen below it.
 */
export const cmsRoutes: RouteObject = {
  path: "cms",
  element: (
    <AuthProvider client={cmsAuth}>
      <Suspense fallback={<AuthLoading/>}>
        <Outlet/>
      </Suspense>
    </AuthProvider>
  ),
  children: [
    {path: "sign-in", element: <SignIn/>},
    {path: "callback", element: <Callback/>},
    {
      /* Pathless layout route, so every screen the CMS grows shares one gate and one frame. */
      element: (
        <RequireAuth restoringKey="admin:common.restoring">
          <ToastProvider>
            <CmsProvider>
              <CmsLayout/>
            </CmsProvider>
          </ToastProvider>
        </RequireAuth>
      ),
      children: [
        {index: true, element: <Overview/>},

        {path: "content", element: <ContentRedirect/>},
        {path: "content/:collection", element: <ContentList/>},
        {path: "content/:collection/new", element: <ContentEditor/>},
        {path: "content/:collection/:id", element: <ContentEditor/>},

        {path: "legal", element: <LegalList/>},
        {path: "legal/new", element: <LegalEditor/>},
        {path: "legal/:id", element: <LegalEditor/>},

        {path: "email/templates", element: <TemplateList/>},
        {path: "email/templates/new", element: <TemplateEditor/>},
        {path: "email/templates/:id", element: <TemplateEditor/>},

        {path: "email/messages", element: <EmailList/>},
        {path: "email/messages/new", element: <EmailCompose/>},
        {path: "email/messages/:id", element: <EmailDetail/>},

        {path: "audit", element: <AuditLog/>},
      ],
    },
    {path: "*", element: <NotFound/>},
  ],
};
