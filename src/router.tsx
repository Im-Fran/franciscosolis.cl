import {Suspense} from "react";
import {createBrowserRouter} from "react-router-dom";
import Layout from "@/components/layout.tsx";
import {Home} from "@/pages/home/home.tsx";
import {Brand} from "@/pages/brand/brand.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {accountRoutes, authRoutes, authorizeRoutes} from "@/pages/auth/auth-routes.tsx";
import {cmsRoutes} from "@/pages/cms/cms-routes.tsx";
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
      /* CMS — its own application, signed in under its own client id */
      cmsRoutes,
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