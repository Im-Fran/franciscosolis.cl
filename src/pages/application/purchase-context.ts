import {createContext, useContext} from "react";
import type {Resource} from "@/lib/auth/useResource.ts";
import type {DownloadState} from "@/lib/pages/store.ts";
import type {ApplicationAccess, ReleaseFile} from "@/lib/pages/types.ts";

export type PurchaseContextValue = {
  /** Whether this visitor may download, what it costs and whether the offer has to be shown. */
  access: Resource<ApplicationAccess>;
  /** The download in flight, including the cooldown a non-payer is waiting out. */
  download: DownloadState;
  /**
   * What a Download button calls. It does not decide anything: it asks for a build, and this is
   * where the answer to "does this person have to be offered a payment first" is applied.
   */
  requestDownload: (file: ReleaseFile) => void;
  /** Opens the payment modal with no file behind it — what a "Buy" button in the banner does. */
  offerPayment: () => void;
  /** True while the site is confirming a payment the provider just sent the visitor back from. */
  confirming: boolean;
  /** True once that payment has been confirmed, so the page can say it landed. */
  confirmed: boolean;
};

export const PurchaseContext = createContext<PurchaseContextValue | null>(null);

/**
 * The paid half of the product page.
 *
 * One provider for the whole subtree rather than per Download button: the access answer is one
 * question about one person, the payment modal is one dialog, and a page with four buttons must not
 * ask four times nor be able to open four modals.
 */
export const usePurchase = () => {
  const value = useContext(PurchaseContext);
  if (!value) throw new Error("usePurchase must be used inside the application layout");
  return value;
};
