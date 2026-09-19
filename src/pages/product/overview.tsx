import {useTranslation} from "react-i18next";
import {useProductOverview} from "@/lib/marketplace/content.ts";
import {useProductPage} from "@/pages/product/product-context.ts";
import {OverviewSidebar} from "@/pages/product/components/overview-sidebar.tsx";
import {ProductProse} from "@/pages/product/components/product-prose.tsx";

/**
 * The Overview tab: one Markdown document, with the sidebar beside it.
 *
 * The document stays narrow — `max-w-3xl` is around 70 characters at this size — because this is
 * the one page of a product meant to be *read* rather than scanned, and a line that spans a
 * 27-inch monitor is a line nobody finishes. The sidebar takes the space to its right instead of
 * widening the prose.
 *
 * On a narrow screen the sidebar goes **below** the document rather than above it. The figures are
 * what somebody checks after deciding they are interested; putting them first on a phone would
 * push the sentence explaining what the product *is* off the screen.
 *
 * A failed sidebar call is not fatal and does not replace the page: the document is the point, and
 * a panel of numbers that could not load is worth less than the text it sits beside.
 */
export const ProductOverview = () => {
  const {t} = useTranslation(["product"]);
  const {product, slug} = useProductPage();
  const overview = useProductOverview(slug);
  const body = product.overview_body?.trim();

  const document = body ? (
    <ProductProse source={body} className="min-w-0 flex-1"/>
  ) : (
    <p className="min-w-0 flex-1 py-12 text-center text-sm text-neutral-500">{t("product:overview.empty")}</p>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-3xl">{document}</div>
      {overview.data && <OverviewSidebar slug={slug} overview={overview.data}/>}
    </div>
  );
};
