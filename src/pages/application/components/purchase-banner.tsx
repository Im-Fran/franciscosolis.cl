import {useTranslation} from "react-i18next";
import {CheckCircle, Heart, ShoppingBag, Spinner as SpinnerIcon} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {formatAmount} from "@/lib/pages/store.ts";
import {usePurchase} from "@/pages/application/purchase-context.ts";

/**
 * What this application costs, and where this visitor stands with it.
 *
 * It sits under the banner rather than inside it: the banner is the house standard every product
 * page shares, and whether an application takes money is not part of that shape. A free application
 * renders nothing here at all, which is the common case and should cost nothing to look at.
 *
 * Three states, and they are the service's rather than this component's: somebody who has paid is
 * told so and gets no offer, somebody who has not is offered one, and somebody who has just come
 * back from the provider is told the payment is being confirmed — because it is, and the webhook
 * that settles it arrives on its own schedule.
 */
export const PurchaseBanner = () => {
  const {t, i18n} = useTranslation(["application"]);
  const locale = i18n.resolvedLanguage ?? "en";
  const {access, offerPayment, confirming, confirmed} = usePurchase();

  const state = access.data;
  if (!state || !state.pricing.accepts_payment) return null;

  const {pricing, has_paid: hasPaid} = state;
  const donation = pricing.mode === "donation";

  return (
    <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3 px-4">
      {confirming && (
        <p className="flex items-center gap-2 text-[13px] text-neutral-400" role="status">
          <SpinnerIcon size={15} className="animate-spin"/> {t("application:payment.confirming")}
        </p>
      )}

      {!confirming && confirmed && (
        <p className="flex items-center gap-2 text-[13px] text-emerald-300" role="status">
          <CheckCircle size={15} weight="fill"/> {t("application:payment.confirmed")}
        </p>
      )}

      {!confirming && hasPaid && !confirmed && (
        <p className="flex items-center gap-2 text-[13px] text-neutral-400">
          <CheckCircle size={15} weight="fill" className="text-emerald-400"/>
          {donation ? t("application:payment.thanks") : t("application:payment.owned")}
        </p>
      )}

      {!confirming && !hasPaid && (
        <>
          {pricing.mode === "paid" && pricing.price !== null && pricing.price !== undefined && (
            <span className="font-display text-lg text-text">
              {formatAmount(pricing.price, pricing.currency, locale)}
            </span>
          )}
          <Button size="sm" onClick={offerPayment}>
            {donation ? <Heart size={15}/> : <ShoppingBag size={15}/>}
            {donation ? t("application:payment.support_cta") : t("application:payment.buy_cta")}
          </Button>
        </>
      )}
    </div>
  );
};
