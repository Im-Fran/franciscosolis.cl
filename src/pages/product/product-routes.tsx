import {Suspense} from "react";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {LegacyProductRedirect} from "@/pages/product/legacy-redirect.tsx";
import {RequireTab} from "@/pages/product/require-tab.tsx";
import {
  ProductContact,
  ProductLayout,
  ProductOverview,
  ProductReleaseDetail,
  ProductReleases,
  ProductReviews,
  ProductWiki,
} from "@/pages/product/lazy-screens.tsx";

/**
 * Everything under `/product/:slug`.
 *
 * Each tab is a route rather than a piece of component state: linking somebody to a changelog
 * entry, one wiki page or a single version is the normal case for a product page, and a tab bar
 * that cannot be linked to is a worse version of the navigation it stands in for. The wiki carries
 * a second segment for the open page, and a release carries two — its channel and its version —
 * for the same reason.
 *
 * The layout resolves the slug once and 404s a draft, so every screen below can assume a published
 * product; `RequireTab` sends a visitor back to the Overview when the tab they asked for is one
 * this product did not turn on.
 *
 * The version detail sits under the `releases` tab's guard rather than beside it: it is the same
 * content one level down, and a product with its Releases tab off has no versions to show.
 */
export const productRoutes: RouteObject = {
  path: "product/:slug",
  element: (
    <Suspense fallback={<AuthLoading/>}>
      <ProductLayout/>
    </Suspense>
  ),
  children: [
    {index: true, element: <ProductOverview/>},
    {
      path: "releases",
      element: (
        <RequireTab tab="releases">
          <ProductReleases/>
        </RequireTab>
      ),
    },
    {
      path: "releases/:channel/:version",
      element: (
        <RequireTab tab="releases">
          <ProductReleaseDetail/>
        </RequireTab>
      ),
    },
    {
      path: "wiki",
      element: (
        <RequireTab tab="wiki">
          <ProductWiki/>
        </RequireTab>
      ),
    },
    {
      path: "wiki/:page",
      element: (
        <RequireTab tab="wiki">
          <ProductWiki/>
        </RequireTab>
      ),
    },
    {
      path: "reviews",
      element: (
        <RequireTab tab="reviews">
          <ProductReviews/>
        </RequireTab>
      ),
    },
    {
      path: "contact",
      element: (
        <RequireTab tab="contact">
          <ProductContact/>
        </RequireTab>
      ),
    },
    {path: "*", element: <NotFound/>},
  ],
};

/**
 * Where `/application/:slug` used to be.
 *
 * The redirect itself lives in its own module — see `legacy-redirect.tsx` for why it maps the tail
 * across rather than dropping it.
 */
export const legacyProductRoutes: RouteObject = {
  path: "application/:slug/*",
  element: <LegacyProductRedirect/>,
};
