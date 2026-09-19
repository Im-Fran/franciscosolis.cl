import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {RequireAuth} from "@/components/auth/require-auth.tsx";
import {AuthProvider} from "@/lib/auth/auth-provider.tsx";
import {ToastProvider} from "@/lib/admin/toast-provider.tsx";
import {marketplaceAuth} from "@/lib/marketplace/client.ts";
import {MarketplaceProvider} from "@/lib/marketplace/marketplace-provider.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {
  Callback,
  MarketplaceLayout,
  ProductEditor,
  ProductList,
  ReleaseEditor,
  ReleaseList,
  SaleDetail,
  SalesList,
  SignIn,
  VoucherList,
  WikiEditor,
  WikiList,
} from "@/pages/marketplace/lazy-screens.tsx";

/**
 * The marketplace console, at `/marketplace`.
 *
 * The same shape as the CMS's and the support team's: its own `AuthProvider` over the subtree so
 * the session lives in its own storage namespace, `sign-in` and `callback` outside the gate, and
 * then a **pathless** layout route holding everything else — one gate, one provider, one shell for
 * every screen the console grows.
 *
 * It is a client application of its own, and unlike the support console that is not a design
 * preference — it is what the service requires. `apps/marketplace` accepts only its own audience,
 * so a console signing in under the CMS's client id gets a 401 on every call *before* the
 * permission is ever read, which this side cannot tell apart from an expired session. The console
 * lived at `/cms/marketplace` for exactly one release and did precisely that, looping through the
 * CMS's sign-in screen forever.
 *
 * `/marketplace` does not compete with the public `/product/:slug`: it is a static segment and a
 * different one. The storefront and the console are deliberately separate addresses, the same way
 * `/help` and `/support` are.
 */
export const marketplaceRoutes: RouteObject = {
  path: "marketplace",
  element: (
    <AuthProvider client={marketplaceAuth}>
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
            <MarketplaceProvider>
              <MarketplaceLayout />
            </MarketplaceProvider>
          </ToastProvider>
        </RequireAuth>
      ),
      children: [
        {index: true, element: <ProductList />},
        /* `new` is literal and must stay ahead of `:id`. */
        {path: "new", element: <ProductEditor />},
        {path: ":id", element: <ProductEditor />},
        {path: ":id/releases", element: <ReleaseList />},
        {path: ":id/releases/new", element: <ReleaseEditor />},
        {path: ":id/releases/:releaseId", element: <ReleaseEditor />},
        {path: ":id/wiki", element: <WikiList />},
        {path: ":id/wiki/new", element: <WikiEditor />},
        {path: ":id/wiki/:pageId", element: <WikiEditor />},
        /*
         * The sales of one product, and the receipts it issued. Not tabs on the product page —
         * that set is a house standard the service enforces with a registry — but sections of this
         * console, which is where the takings belong.
         */
        {path: ":id/sales", element: <SalesList />},
        {path: ":id/sales/:saleId", element: <SaleDetail />},
        {path: ":id/vouchers", element: <VoucherList />},
        {path: "*", element: <NotFound />},
      ],
    },
    {path: "*", element: <NotFound />},
  ],
};
