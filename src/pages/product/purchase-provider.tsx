import {useCallback, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {useDownload, usePaymentReturn, useProductAccess} from "@/lib/marketplace/store.ts";
import type {AccessGate, Product, ReleaseFile} from "@/lib/marketplace/types.ts";
import type {DownloadRequestOptions} from "@/pages/product/purchase-context.ts";
import {PurchaseContext} from "@/pages/product/purchase-context.ts";
import {PaymentModal} from "@/pages/product/components/payment-modal.tsx";

/**
 * Holds everything about money and downloads for one product page, and owns the one payment dialog.
 *
 * The decision this file exists to centralise is `requestDownload`. A Download button says "this
 * build, please" and nothing else; whether that opens the payment modal, starts a five-second
 * cooldown or downloads immediately is answered here from the service's `access`, once, for every
 * button on the page. A button that decided for itself would be a button that could be wrong on its
 * own — and the one that goes wrong is the one that gives a paid build away.
 */
export const PurchaseProvider = ({product, children}: {product: Product; children: ReactNode}) => {
  const access = useProductAccess(product.slug);
  const download = useDownload(product.slug);
  const {confirming, confirmed} = usePaymentReturn(access);

  const [offering, setOffering] = useState(false);
  /** The build the visitor asked for before the offer interrupted them, so skipping resumes it. */
  const [pendingFile, setPendingFile] = useState<ReleaseFile | null>(null);
  /**
   * Which gate the open dialog is about, so it can say *why*.
   *
   * "This product has to be paid for" and "this nightly is what paying gets you" are different
   * sentences, and a `donation` product with its pre-release lines reserved says the second one
   * while its stable build stays free to take.
   */
  const [gate, setGate] = useState<AccessGate>("paid");

  const requestDownload = useCallback(
    (file: ReleaseFile, options: DownloadRequestOptions = {}) => {
      const state = access.data;

      /*
       * While the answer is still loading, the offer is the safe side to err on: showing a dialog
       * to somebody who had already paid costs them a click, and skipping it for somebody who has
       * not costs the price of the product.
       */
      if (!state || state.must_offer_payment) {
        setGate(state?.gate === "pre_release" ? "pre_release" : "paid");
        setPendingFile(file);
        setOffering(true);
        return;
      }

      /*
       * The channel gate, composed from two facts the service already decided rather than from a
       * second copy of the rule: `channel_requires_purchase` is a property of the release (is this
       * *line* reserved for supporters), and `has_paid` is a property of this caller. Neither is
       * re-derived here — and if this side ever got it wrong, minting the ticket still answers 402,
       * because the service applies the same gate again where it actually matters.
       */
      if (options.channelRequiresPurchase && !state.has_paid) {
        setGate("pre_release");
        setPendingFile(file);
        setOffering(true);
        return;
      }

      download.start(file.id, file.filename);
    },
    [access.data, download],
  );

  const offerPayment = useCallback(() => {
    setGate("paid");
    setPendingFile(null);
    setOffering(true);
  }, []);

  const close = useCallback(() => {
    setOffering(false);
    setPendingFile(null);
  }, []);

  /** Declining an optional payment: close the dialog and give them the build they came for. */
  const skip = useCallback(() => {
    setOffering(false);
    if (pendingFile) download.start(pendingFile.id, pendingFile.filename);
    setPendingFile(null);
  }, [download, pendingFile]);

  const value = useMemo(
    () => ({access, download, requestDownload, offerPayment, confirming, confirmed}),
    [access, download, requestDownload, offerPayment, confirming, confirmed],
  );

  /*
   * Declining is offered only when the service says the build can be had without paying *and* the
   * dialog is not the pre-release one. A supporters-only nightly has nothing to skip to: skipping
   * it would start a download the service is about to refuse.
   */
  const canSkip = (access.data?.pricing.allows_skip ?? false) && gate !== "pre_release";

  return (
    <PurchaseContext value={value}>
      {children}
      {access.data && (
        <PaymentModal
          open={offering}
          onClose={close}
          product={product}
          access={access.data}
          gate={gate}
          onSkip={canSkip ? skip : undefined}
        />
      )}
    </PurchaseContext>
  );
};
