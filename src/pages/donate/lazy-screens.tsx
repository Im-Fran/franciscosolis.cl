import {lazy} from "react";

/*
 * The donation page pulls in the store client and its hooks, which a visitor of the landing page
 * never needs. Same treatment as `/legal` and the product pages.
 */
export const Donate = lazy(() => import("@/pages/donate/donate.tsx").then((m) => ({default: m.Donate})));
