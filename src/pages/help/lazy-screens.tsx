import {lazy} from "react";

/**
 * The help centre's screens, split out of the main bundle.
 *
 * Same reason as every other section here: a visitor reading the landing page should not download
 * the ticket form, and somebody following a link from a support email should not download the rest
 * of the site before they can read the reply.
 */
export const HelpHome = lazy(() => import("@/pages/help/help-home.tsx").then((m) => ({default: m.HelpHome})));
export const HelpSearch = lazy(() => import("@/pages/help/help-search.tsx").then((m) => ({default: m.HelpSearch})));
export const HelpCategory = lazy(() =>
  import("@/pages/help/help-category.tsx").then((m) => ({default: m.HelpCategory})),
);
export const HelpArticle = lazy(() => import("@/pages/help/help-article.tsx").then((m) => ({default: m.HelpArticle})));
export const TicketNew = lazy(() => import("@/pages/help/ticket-new.tsx").then((m) => ({default: m.TicketNew})));
export const TicketThread = lazy(() =>
  import("@/pages/help/ticket-thread.tsx").then((m) => ({default: m.TicketThread})),
);
export const MyTickets = lazy(() => import("@/pages/help/my-tickets.tsx").then((m) => ({default: m.MyTickets})));
