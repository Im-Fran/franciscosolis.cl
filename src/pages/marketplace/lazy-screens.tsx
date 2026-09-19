import {lazy} from "react";

/*
 * Every console screen, split out of the main bundle. The same reasoning as the CMS's and the
 * support console's: these carry a Markdown editor, a sortable list and a data table that a visitor
 * reading a product page has no use for.
 *
 * The layout is in here too, for the same reason: the shell, its navigation and the no-access screen
 * are console furniture, and the landing page should not carry them either.
 */

export const MarketplaceLayout = lazy(() =>
  import("@/pages/marketplace/components/marketplace-layout.tsx").then((m) => ({
    default: m.MarketplaceLayout,
  })),
);

export const SignIn = lazy(() =>
  import("@/pages/marketplace/sign-in.tsx").then((m) => ({default: m.SignIn})),
);
export const Callback = lazy(() =>
  import("@/pages/marketplace/callback.tsx").then((m) => ({default: m.Callback})),
);

export const ProductList = lazy(() =>
  import("@/pages/marketplace/product-list.tsx").then((m) => ({default: m.ProductList})),
);
export const ProductEditor = lazy(() =>
  import("@/pages/marketplace/product-editor.tsx").then((m) => ({default: m.ProductEditor})),
);
export const ReleaseList = lazy(() =>
  import("@/pages/marketplace/release-list.tsx").then((m) => ({default: m.ReleaseList})),
);
export const ReleaseEditor = lazy(() =>
  import("@/pages/marketplace/release-editor.tsx").then((m) => ({default: m.ReleaseEditor})),
);
export const WikiList = lazy(() =>
  import("@/pages/marketplace/wiki-list.tsx").then((m) => ({default: m.WikiList})),
);
export const WikiEditor = lazy(() =>
  import("@/pages/marketplace/wiki-editor.tsx").then((m) => ({default: m.WikiEditor})),
);
export const SalesList = lazy(() =>
  import("@/pages/marketplace/sales-list.tsx").then((m) => ({default: m.SalesList})),
);
export const SaleDetail = lazy(() =>
  import("@/pages/marketplace/sale-detail.tsx").then((m) => ({default: m.SaleDetail})),
);
export const VoucherList = lazy(() =>
  import("@/pages/marketplace/voucher-list.tsx").then((m) => ({default: m.VoucherList})),
);
