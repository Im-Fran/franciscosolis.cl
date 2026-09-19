import {Suspense} from "react";
import {createBrowserRouter} from "react-router-dom";
import Layout from "@/components/layout.tsx";
import {Home} from "@/pages/home/home.tsx";
import {Brand} from "@/pages/brand/brand.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {accountRoutes, authRoutes, authorizeRoutes} from "@/pages/auth/auth-routes.tsx";
import {cmsRoutes} from "@/pages/cms/cms-routes.tsx";
import {helpRoutes, ticketRoutes} from "@/pages/help/help-routes.tsx";
import {supportRoutes} from "@/pages/support/support-routes.tsx";
import {marketplaceRoutes} from "@/pages/marketplace/marketplace-routes.tsx";
import {legacyProductRoutes, productRoutes} from "@/pages/product/product-routes.tsx";
import {CmsLegacyRedirect} from "@/pages/cms/components/legacy-redirect.tsx";
import {Legal} from "@/pages/legal/lazy-screens.tsx";

const routes = [
  {
    path: "/",
    element: <Layout/>,
    children: [
      /* Home */
      {
        index: true,
        element: <Home/>,
      },
      /* Brand */
      {
        path: "brand",
        element: <Brand/>,
      },
      /* Legal */
      {
        path: "legal",
        element: (
          <Suspense fallback={<AuthLoading/>}>
            <Legal/>
          </Suspense>
        ),
      },
      /* Auth — the sign-in hand-off, the OAuth callback and the administration console */
      authRoutes,
      /* Your account, at the top level: it is a page of this site, not part of the issuer */
      accountRoutes,
      /* The auth service's hosted sign-in screen, where /oauth/authorize sends the browser */
      authorizeRoutes,
      /* CMS — its own client application, signed in under its own client id */
      cmsRoutes,
      /* The public help centre, and the ticket a support email links to. Both outside every gate. */
      helpRoutes,
      ticketRoutes,
      /* The support team's console — its own client application, signed in under its own client id */
      supportRoutes,
      /*
       * The marketplace console. Its own client application too, and here that is what the service
       * requires rather than a preference: `apps/marketplace` accepts only its own audience, so an
       * editor signing in under the CMS's client id is refused before the permission is ever read.
       */
      marketplaceRoutes,
      /*
       * The marketplace. Registered after the console routes deliberately: React Router ranks
       * a static segment above a dynamic one, so `/cms` and `/auth` win over `product/:slug`
       * whatever the order here — but reading the list top to bottom should still put the site's
       * own sections before the products it hosts.
       */
      productRoutes,
      /* These pages were at /application/:slug before the store; old links still resolve */
      legacyProductRoutes,
      /* The CMS moved from /apps/cms to /cms; old links and bookmarks still resolve */
      {
        path: "apps/cms/*",
        element: <CmsLegacyRedirect/>,
      },
      /* 404 */
      {
        path: "*",
        element: <NotFound/>,
      },
    ],
  },
];


const router = createBrowserRouter(routes, {
  basename: '/',
});

export default router;