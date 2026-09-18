import {Suspense} from "react";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {RequireTab} from "@/pages/application/require-tab.tsx";
import {
  ApplicationContact,
  ApplicationLayout,
  ApplicationOverview,
  ApplicationUpdates,
  ApplicationWiki,
} from "@/pages/application/lazy-screens.tsx";

/**
 * Everything under `/application/:slug`.
 *
 * Each tab is a route rather than a piece of component state: linking somebody to a changelog entry
 * or to one wiki page is the normal case for a product page, and a tab bar that cannot be linked to
 * is a worse version of the navigation it stands in for. The wiki carries a second segment for the
 * open page, for the same reason.
 *
 * The layout resolves the slug once and 404s a draft, so every screen below can assume a published
 * application; `RequireTab` sends a visitor back to the Overview when the tab they asked for is one
 * this application did not turn on.
 */
export const applicationRoutes: RouteObject = {
  path: "application/:slug",
  element: (
    <Suspense fallback={<AuthLoading/>}>
      <ApplicationLayout/>
    </Suspense>
  ),
  children: [
    {index: true, element: <ApplicationOverview/>},
    {
      path: "updates",
      element: (
        <RequireTab tab="updates">
          <ApplicationUpdates/>
        </RequireTab>
      ),
    },
    {
      path: "wiki",
      element: (
        <RequireTab tab="wiki">
          <ApplicationWiki/>
        </RequireTab>
      ),
    },
    {
      path: "wiki/:page",
      element: (
        <RequireTab tab="wiki">
          <ApplicationWiki/>
        </RequireTab>
      ),
    },
    {
      path: "contact",
      element: (
        <RequireTab tab="contact">
          <ApplicationContact/>
        </RequireTab>
      ),
    },
    {path: "*", element: <NotFound/>},
  ],
};
