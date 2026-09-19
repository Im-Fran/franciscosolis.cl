import {createContext, useContext} from "react";
import type {Resource} from "@/lib/auth/useResource.ts";
import type {DownloadState} from "@/lib/marketplace/store.ts";
import type {ProductAccess, ReleaseFile} from "@/lib/marketplace/types.ts";

/**
 * What the release a build belongs to says about itself.
 *
 * One field rather than the whole release: the only thing the download decision needs from it is
 * whether this *line* is reserved for supporters, and that is a fact the service computed and put
 * on the release — `channel_requires_purchase` — rather than something derived here.
 */
export type DownloadRequestOptions = {
  channelRequiresPurchase?: boolean;
};

export type PurchaseContextValue = {
  /** Whether this visitor may download, what it costs and whether the offer has to be shown. */
  access: Resource<ProductAccess>;
  /** The download in flight, including the cooldown a non-payer is waiting out. */
  download: DownloadState;
  /**
   * What a Download button calls. It does not decide anything: it asks for a build, and this is
   * where the answer to "does this person have to be offered a payment first" is applied.
   *
   * The options carry what the *release* says about itself, which a button cannot know from the
   * file alone — a build on a reserved pre-release line is gated even on a product whose stable
   * download is free.
   */
  requestDownload: (file: ReleaseFile, options?: DownloadRequestOptions) => void;
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
  if (!value) throw new Error("usePurchase must be used inside the product layout");
  return value;
};
