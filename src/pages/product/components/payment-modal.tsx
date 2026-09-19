import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowSquareOut, Gift, LockKey} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {describeError} from "@/lib/auth/useResource.ts";
import {marketplaceContent} from "@/lib/marketplace/content.ts";
import {formatAmount} from "@/lib/marketplace/store.ts";
import type {AccessGate, Product, ProductAccess} from "@/lib/marketplace/types.ts";

type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  product: Product;
  access: ProductAccess;
  /**
   * Which gate opened this dialog, so it can say *why* rather than only *how much*.
   *
   * `pre_release` is the `donation` case where the nightlies are what paying gets you: the stable
   * build is still free to take, so the dialog must not claim the product has to be paid for.
   */
  gate: AccessGate | string;
  /**
   * Continue without paying. Only ever passed for a product that allows it — the button is
   * absent for a paid one rather than present and refused, because an offer you cannot decline
   * should not look like one.
   */
  onSkip?: () => void;
};

/**
 * The offer to pay for a product.
 *
 * Two rules from the service shape this dialog, and neither is re-decided here:
 *
 * - **It is shown to every non-payer, every time.** `must_offer_payment` comes from the service and
 *   the page obeys it. There is no "don't show this again", because the alternative is a paid
 *   product quietly becoming free for whoever cleared it once.
 * - **Declining is a real, visible choice for an optional payment.** `allows_skip` decides whether
 *   the second button exists at all. When it does, the dialog says outright that the download works
 *   without paying — an optional payment that hides its own opt-out is not optional, it is a dark
 *   pattern with a nicer name.
 *
 * Paying needs an account, because that is what a purchase is attached to. Somebody signed out is
 * sent through the site's own sign-in first and comes back here.
 */
export const PaymentModal = ({open, onClose, product, access, gate, onSkip}: PaymentModalProps) => {
  const {t, i18n} = useTranslation(["product", "common"]);
  const {status, client} = useAuth();
  const locale = i18n.resolvedLanguage ?? "en";

  const {pricing} = access;
  const donation = pricing.mode === "donation";
  /* The supporters-only line. Worded apart from the price, because it is a different refusal. */
  const supportersOnly = gate === "pre_release";
  const minimum = pricing.minimum_amount ?? 0;
  const suggested = pricing.suggested_amount ?? minimum;

  const [amount, setAmount] = useState(String(suggested));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* A suggestion that arrives after the first render — the access call resolving — still prefills. */
  useEffect(() => setAmount(String(suggested)), [suggested]);

  const parsed = Number.parseInt(amount, 10);
  const amountValid = !donation || (Number.isFinite(parsed) && parsed >= minimum);

  const pay = async () => {
    setError(null);

    /* No account yet: the purchase has nowhere to live, so sign in first and come back here. */
    if (status !== "authenticated") {
      await client.flow.startAuthorization(`${window.location.pathname}${window.location.search}`);
      return;
    }

    setBusy(true);
    try {
      const checkout = await marketplaceContent.checkout(product.slug, {
        ...(donation ? {amount: parsed} : {}),
        return_path: window.location.pathname,
      });
      /* Off to the provider. Nothing after this line runs — the tab is theirs now. */
      window.location.assign(checkout.checkout_url);
    } catch (cause) {
      setBusy(false);
      setError(describeError(cause).message);
    }
  };

  const price = pricing.price ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        supportersOnly
          ? t("product:payment.supporters_title", {name: product.name})
          : donation
            ? t("product:payment.support_title", {name: product.name})
            : t("product:payment.buy_title", {name: product.name})
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-neutral-400">
          {supportersOnly
            ? t("product:payment.supporters_body")
            : donation
              ? t("product:payment.support_body")
              : t("product:payment.buy_body")}
        </p>

        {donation ? (
          <label className="flex flex-col gap-2">
            <span className="text-[13px] text-neutral-400">
              {t("product:payment.amount_label", {currency: pricing.currency})}
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={minimum}
              step={100}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-describedby="payment-minimum"
            />
            <span id="payment-minimum" className="text-[12px] text-neutral-500">
              {t("product:payment.minimum", {amount: formatAmount(minimum, pricing.currency, locale)})}
            </span>
          </label>
        ) : (
          <p className="flex items-baseline gap-2">
            <span className="font-display text-3xl text-text">{formatAmount(price, pricing.currency, locale)}</span>
            <span className="text-[13px] text-neutral-500">{pricing.currency}</span>
          </p>
        )}

        {/*
          * The two sentinels `useResource` produces get the site's own wording; anything else is a
          * sentence the service wrote for a person ("This account has already bought this
          * product") and is worth more than a generic line would be.
          */}
        {error && (
          <Alert tone="error">
            {error === "network"
              ? t("common:content_unreachable")
              : error === "unexpected"
                ? t("common:content_failed")
                : error}
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={() => void pay()} disabled={busy || !amountValid}>
            {busy ? <Spinner size={16}/> : <ArrowSquareOut size={16}/>}
            {status === "authenticated"
              ? t("product:payment.pay")
              : t("product:payment.sign_in_and_pay")}
          </Button>

          {/*
            * The opt-out, stated in full. It only exists when the service says the product
            * allows it, and when it does it is a button of its own rather than a link buried in the
            * small print — the whole point is that refusing is easy.
            */}
          {onSkip && (
            <>
              <Button variant="ghost" onClick={onSkip}>
                <Gift size={16}/> {t("product:payment.skip")}
              </Button>
              <p className="text-center text-[12px] text-neutral-500">{t("product:payment.skip_hint")}</p>
            </>
          )}

          {!onSkip && (
            <p className="flex items-start gap-2 text-[12px] text-neutral-500">
              <LockKey size={14} className="mt-0.5 shrink-0"/> {t("product:payment.paid_hint")}
            </p>
          )}
        </div>

        <p className="text-center text-[12px] text-neutral-600">{t("product:payment.provider")}</p>
      </div>
    </Modal>
  );
};
