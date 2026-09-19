import type {ReactNode} from "react";
import {Navigate} from "react-router-dom";
import {productRoute} from "@/lib/marketplace/config.ts";
import {useProductPage} from "@/pages/product/product-context.ts";

/**
 * Guards a tab against being reached on a product that did not turn it on.
 *
 * Which tabs a product has is data, not routing, so the router cannot express it — every
 * product answers the same five paths and only the row says which of them mean anything. A tab
 * that is off is the wrong address rather than an error, so it redirects to the Overview, which
 * every product has, instead of rendering an empty panel under a tab bar the tab is not on.
 *
 * It lives in its own module rather than in the layout because the routes import it eagerly while
 * every screen below is lazy; pulling it out of the layout would drag the Markdown renderer into
 * the landing page's bundle.
 */
export const RequireTab = ({tab, children}: {tab: string; children: ReactNode}) => {
  const {product, slug} = useProductPage();
  if (!product.tabs.includes(tab)) return <Navigate to={productRoute.overview(slug)} replace/>;
  return <>{children}</>;
};
