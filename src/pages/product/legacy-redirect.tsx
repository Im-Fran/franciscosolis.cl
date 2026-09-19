import {Navigate, useParams} from "react-router-dom";
import {PRODUCT_ROUTE} from "@/lib/marketplace/config.ts";

/** The one renamed segment. Everything else kept its name through the move. */
const RENAMED_SEGMENTS: Record<string, string> = {updates: "releases"};

/**
 * Sends `/application/:slug/*` to `/product/:slug/*`.
 *
 * This section was the "standalone application pages" before it was a store, and that address is
 * the one a published README, a store listing and somebody's bookmark still point at. Turning those
 * into 404s would cost traffic for nothing.
 *
 * The tail is carried across rather than dropped, so a link to a particular tab still lands on that
 * tab: `/application/x/updates` was the changelog and `/product/x/releases` is the same changelog
 * under the name it has now. Anything the map does not mention kept its own name — the wiki and its
 * page segment, and contact, all still read the same.
 *
 * It lives in its own module because the route table imports it eagerly while every screen below is
 * lazy, and a file that exports both a component and a route object loses fast refresh.
 */
export const LegacyProductRedirect = () => {
  const params = useParams();
  const slug = params.slug ?? "";
  const rest = params["*"] ?? "";

  const [head, ...tail] = rest.split("/").filter(Boolean);
  const mapped = head ? [RENAMED_SEGMENTS[head] ?? head, ...tail].join("/") : "";

  return <Navigate to={`${PRODUCT_ROUTE}/${slug}${mapped ? `/${mapped}` : ""}`} replace/>;
};
