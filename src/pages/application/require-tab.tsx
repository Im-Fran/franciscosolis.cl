import type {ReactNode} from "react";
import {Navigate} from "react-router-dom";
import {applicationRoute} from "@/lib/pages/config.ts";
import {useApplicationPage} from "@/pages/application/application-context.ts";

/**
 * Guards a tab against being reached on an application that did not turn it on.
 *
 * Which tabs an application has is data, not routing, so the router cannot express it — every
 * application answers the same five paths and only the row says which of them mean anything. A tab
 * that is off is the wrong address rather than an error, so it redirects to the Overview, which
 * every application has, instead of rendering an empty panel under a tab bar the tab is not on.
 *
 * It lives in its own module rather than in the layout because the routes import it eagerly while
 * every screen below is lazy; pulling it out of the layout would drag the Markdown renderer into
 * the landing page's bundle.
 */
export const RequireTab = ({tab, children}: {tab: string; children: ReactNode}) => {
  const {application, slug} = useApplicationPage();
  if (!application.tabs.includes(tab)) return <Navigate to={applicationRoute.overview(slug)} replace/>;
  return <>{children}</>;
};
