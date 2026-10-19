import {Suspense} from "react";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {DONATE_ROUTE} from "@/lib/marketplace/config.ts";
import {SpanishAlias} from "@/pages/donate/spanish-alias.tsx";
import {Donate} from "@/pages/donate/lazy-screens.tsx";

/** The donation link: support for the projects in general, not for one product. */
export const donateRoutes: RouteObject[] = [
  {
    path: DONATE_ROUTE.slice(1),
    element: (
      <Suspense fallback={<AuthLoading/>}>
        <Donate/>
      </Suspense>
    ),
  },
  {
    path: "donar",
    element: <SpanishAlias/>,
  },
];
