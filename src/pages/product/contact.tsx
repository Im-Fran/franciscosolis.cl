import {useTranslation} from "react-i18next";
import {useProductPage} from "@/pages/product/product-context.ts";
import {ProductProse} from "@/pages/product/components/product-prose.tsx";

/**
 * The Contact tab: how to reach whoever maintains this product.
 *
 * Only the editorial body lives here. The product's links already sit under the banner, a few
 * pixels above this text and in view the whole time — repeating them at the bottom of the tab said
 * the same thing twice rather than giving a visitor anywhere new to go.
 */
export const ProductContact = () => {
  const {t} = useTranslation(["product"]);
  const {product} = useProductPage();
  const body = product.contact_body?.trim();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {body ? (
        <ProductProse source={body}/>
      ) : (
        <p className="py-8 text-center text-sm text-neutral-500">{t("product:contact.empty")}</p>
      )}
    </div>
  );
};
