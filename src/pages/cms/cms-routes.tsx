import {Suspense} from "react";
import {Navigate, Outlet} from "react-router-dom";
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
import {MARKETPLACE_ADMIN_ROUTE} from "@/lib/marketplace/config.ts";
import {
  ProductEditor,
  ProductList,
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
  SaleDetail,
  SalesList,
  SignIn,
  TemplateEditor,
  TemplateList,
  ReleaseEditor,
  ReleaseList,
  VoucherList,
  WikiEditor,
  WikiList,
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

        /*
         * The marketplace. It is a different service — `apps/marketplace` rather than `apps/cms` —
         * but not a different client application: it accepts the CMS's audience precisely so these
         * screens can live inside this gate and this session instead of asking an editor to sign in
         * a second time for a second console.
         */
        {path: "marketplace", element: <ProductList/>},
        {path: "marketplace/new", element: <ProductEditor/>},
        {path: "marketplace/:id", element: <ProductEditor/>},
        {path: "marketplace/:id/releases", element: <ReleaseList/>},
        {path: "marketplace/:id/releases/new", element: <ReleaseEditor/>},
        {path: "marketplace/:id/releases/:releaseId", element: <ReleaseEditor/>},
        {path: "marketplace/:id/wiki", element: <WikiList/>},
        {path: "marketplace/:id/wiki/new", element: <WikiEditor/>},
        {path: "marketplace/:id/wiki/:pageId", element: <WikiEditor/>},

        /*
         * The sales of one product, and the receipts it issued. Not tabs on the product page —
         * that set is a house standard the service enforces with a registry — but sections of this
         * console, which is where the takings belong.
         */
        {path: "marketplace/:id/sales", element: <SalesList/>},
        {path: "marketplace/:id/sales/:saleId", element: <SaleDetail/>},
        {path: "marketplace/:id/vouchers", element: <VoucherList/>},

        /*
         * The editorial screens that came with the store are deliberately not here yet: review
         * moderation, the cross-product report queue, per-release compatibility and the analytics
         * series are the second half of this work. The public page is what breaks when the service
         * is renamed, so it goes first.
         */

        /* The address these screens lived at before the rename, kept so a bookmark still lands. */
        {path: "pages/*", element: <Navigate to={MARKETPLACE_ADMIN_ROUTE} replace/>},

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
