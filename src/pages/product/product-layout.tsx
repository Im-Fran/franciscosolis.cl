import {useEffect, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Link, Outlet, useParams} from "react-router-dom";
import {ArrowLeft, GlobeSimple} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {BrandLockup} from "@/components/brand";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {marketplaceContent, useProduct} from "@/lib/marketplace/content.ts";
import {SectionError} from "@/pages/home/components/section-state.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {ProductBanner} from "@/pages/product/components/product-banner.tsx";
import {PurchaseBanner} from "@/pages/product/components/purchase-banner.tsx";
import {ProductContext} from "@/pages/product/product-context.ts";
import {PurchaseProvider} from "@/pages/product/purchase-provider.tsx";

/**
 * The frame every tab of a product page sits in.
 *
 * The product is loaded once, here, rather than by each tab: the banner, the tab bar and the
 * body all need the same row, and four screens fetching it would reload the header on every tab
 * change. Everything below reads it from `ProductContext`, which is what lets a tab be a small
 * component that only knows about its own content.
 *
 * A slug the service does not publish is the site's own 404 rather than an error panel. From a
 * visitor's side there is no difference between a product that was never created and one that
 * is still a draft, and the service is deliberately unable to tell them apart either.
 *
 * `PurchaseProvider` wraps the whole page rather than the tab that happens to have download buttons
 * on it: the price belongs under the banner, the offer is one dialog, and "has this person paid" is
 * one question that must not be asked once per button.
 */
export const ProductLayout = () => {
  const {t} = useTranslation(["product"]);
  const {slug = ""} = useParams<{slug: string}>();
  const {language, toggleLanguage} = useLanguageToggle();
  const resource = useProduct(slug);

  const value = useMemo(
    () => (resource.data ? {product: resource.data, slug} : null),
    [resource.data, slug],
  );

  const productId = resource.data?.id;

  /*
   * One view of this product, counted once the page has actually resolved to something.
   *
   * A POST rather than a side effect of the read: the read is cached, and a counter that only
   * increments on a cache miss counts caches rather than people. The service deduplicates per
   * viewer over a window of its own, so this is an estimate of attention and not a record of
   * anybody — and it is fire-and-forget, because a counter that could break the page it counts
   * would be a very bad trade. It fires on the product, not per tab: switching tabs is not a
   * second visit.
   */
  useEffect(() => {
    if (!productId) return;
    void marketplaceContent.countView(slug).catch(() => {});
  }, [slug, productId]);

  if (resource.loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner size={28} label={t("product:loading")}/>
      </div>
    );
  }

  if (resource.status === 404) return <NotFound/>;

  if (resource.error || !value) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24">
        <SectionError error={resource.error ?? "unexpected"} onRetry={resource.reload}/>
      </div>
    );
  }

  /* The API says which language it actually served; asking for `es` does not guarantee getting it. */
  const untranslated = value.product.locale !== undefined && value.product.locale !== language;

  return (
    <ProductContext value={value}>
      <PurchaseProvider product={value.product}>
        <div className="flex flex-1 flex-col pb-24">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-text">
            <BrandLockup size={24} tone="auto"/>
            <span className="sr-only">{t("product:back_home")}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft size={15}/>
                <span className="hidden sm:inline">{t("product:back_home")}</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              aria-label={t("common:toggle_lang", {lang: language === "es" ? "EN" : "ES"})}
            >
              <GlobeSimple size={15}/> {language === "es" ? "EN" : "ES"}
            </Button>
          </div>
        </div>

        <ProductBanner product={value.product}/>

        <PurchaseBanner/>

        {untranslated && (
          <p className="mx-auto mt-6 max-w-3xl px-4 text-center text-[13px] text-neutral-500">
            {t("product:untranslated")}
          </p>
        )}

        <main className="mx-auto mt-10 w-full max-w-6xl px-4">
          <Outlet/>
        </main>
        </div>
      </PurchaseProvider>
    </ProductContext>
  );
};
