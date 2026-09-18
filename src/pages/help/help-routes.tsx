import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import type {RouteObject} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {HelpArticle, HelpCategory, HelpHome, HelpSearch, TicketNew, TicketThread} from "@/pages/help/lazy-screens.tsx";

/**
 * The public half of support: the help centre at `/help`, and a ticket at `/tickets/<reference>`.
 *
 * Both sit outside every gate. That is the point — somebody who cannot sign in is exactly the person
 * most likely to need support, and requiring an account here would lock out the hardest cases. The
 * ticket screen identifies its reader from the secret in the emailed link, or from the site's own
 * session when there happens to be one.
 *
 * `c/` and `a/` are literal segments rather than `/help/:slug` for a reason that bites later
 * otherwise: without them, `/help/new` and an article slugged `new` are the same address, and React
 * Router's static-beats-dynamic ranking papers over it right up until somebody publishes one.
 */
export const helpRoutes: RouteObject = {
  path: "help",
  element: (
    <Suspense fallback={<AuthLoading />}>
      <Outlet />
    </Suspense>
  ),
  children: [
    {index: true, element: <HelpHome />},
    {path: "search", element: <HelpSearch />},
    {path: "new", element: <TicketNew />},
    {path: "c/:slug", element: <HelpCategory />},
    {path: "a/:slug", element: <HelpArticle />},
    {path: "*", element: <NotFound />},
  ],
};

/**
 * The ticket view, at the top level rather than under `/help`.
 *
 * It is the address in every support email ever sent, and those live in people's mailboxes for
 * years. `/tickets/FS-1042` is short enough to read out loud and stable enough to keep.
 */
export const ticketRoutes: RouteObject = {
  path: "tickets",
  element: (
    <Suspense fallback={<AuthLoading />}>
      <Outlet />
    </Suspense>
  ),
  children: [
    {path: ":reference", element: <TicketThread />},
    {path: "*", element: <NotFound />},
  ],
};
