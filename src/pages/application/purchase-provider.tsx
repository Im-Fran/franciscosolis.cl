import {useCallback, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {useApplicationAccess, useDownload, usePaymentReturn} from "@/lib/pages/store.ts";
import type {Application, ReleaseFile} from "@/lib/pages/types.ts";
import {PurchaseContext} from "@/pages/application/purchase-context.ts";
import {PaymentModal} from "@/pages/application/components/payment-modal.tsx";

/**
 * Holds everything about money and downloads for one product page, and owns the one payment dialog.
 *
 * The decision this file exists to centralise is `requestDownload`. A Download button says "this
 * build, please" and nothing else; whether that opens the payment modal, starts a five-second
 * cooldown or downloads immediately is answered here from the service's `access`, once, for every
 * button on the page. A button that decided for itself would be a button that could be wrong on its
 * own — and the one that goes wrong is the one that gives a paid build away.
 */
export const PurchaseProvider = ({application, children}: {application: Application; children: ReactNode}) => {
  const access = useApplicationAccess(application.slug);
  const download = useDownload(application.slug);
  const {confirming, confirmed} = usePaymentReturn(access);

  const [offering, setOffering] = useState(false);
  /** The build the visitor asked for before the offer interrupted them, so skipping resumes it. */
  const [pendingFile, setPendingFile] = useState<ReleaseFile | null>(null);

  const requestDownload = useCallback(
    (file: ReleaseFile) => {
      const state = access.data;

      /*
       * While the answer is still loading, the offer is the safe side to err on: showing a dialog
       * to somebody who had already paid costs them a click, and skipping it for somebody who has
       * not costs the price of the application.
       */
      if (!state || state.must_offer_payment) {
        setPendingFile(file);
        setOffering(true);
        return;
      }

      download.start(file.id, file.filename);
    },
    [access.data, download],
  );

  const offerPayment = useCallback(() => {
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

  return (
    <PurchaseContext value={value}>
      {children}
      {access.data && (
        <PaymentModal
          open={offering}
          onClose={close}
          application={application}
          access={access.data}
          /* Passed only when the service says this application can be had without paying. */
          onSkip={access.data.pricing.allows_skip ? skip : undefined}
        />
      )}
    </PurchaseContext>
  );
};
