import {Navigate, useLocation} from "react-router-dom";
import {ACCOUNT_ROUTE, LEGACY_ACCOUNT_ROUTE} from "@/lib/auth/config.ts";

/**
 * The account used to live at `/auth/account`. Every tab was a route precisely so it could be
 * bookmarked and sent to somebody, so those URLs are forwarded rather than dropped: the whole
 * sub-path travels across, and so does the query string — a `?return_to=` that survived a sign-in
 * is still meant for the screen on the other side.
 */
export const AccountLegacyRedirect = () => {
  const {pathname, search, hash} = useLocation();
  const rest = pathname.startsWith(LEGACY_ACCOUNT_ROUTE) ? pathname.slice(LEGACY_ACCOUNT_ROUTE.length) : "";
  return <Navigate to={`${ACCOUNT_ROUTE}${rest}${search}${hash}`} replace/>;
};
