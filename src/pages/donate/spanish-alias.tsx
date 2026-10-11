import {Navigate, useLocation} from "react-router-dom";
import {DONATE_ROUTE} from "@/lib/marketplace/config.ts";

/**
 * `/donar` is the address people say out loud in Spanish, so it lands on the same page rather than
 * on a 404. Redirected rather than served twice, so the page has one address to share — and the
 * query string comes along, because a prefilled link (`?amount=…&currency=…`) is the point of it.
 */
export const SpanishAlias = () => {
  const {search} = useLocation();
  return <Navigate to={`${DONATE_ROUTE}${search}`} replace/>;
};
