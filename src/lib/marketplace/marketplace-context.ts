import {createContext, useContext} from "react";

export type MarketplaceEditor = {
  id: string;
  email: string;
};

export type MarketplaceContextValue = {
  /** Who is signed in *here*, as the service sees them, or null while that is unknown. */
  editor: MarketplaceEditor | null;
  loading: boolean;
  /** True when the service answered 403: a live session without the editorial permission. */
  forbidden: boolean;
  error: string | null;
  reload: () => void;
};

export const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

/**
 * Whether this account may edit the marketplace at all.
 *
 * Asked once above the whole signed-in subtree rather than per screen: a live session and the
 * editorial permission are two different questions, and an account holding the first but not the
 * second would otherwise meet nine panels that each fail with their own 403.
 */
export const useMarketplace = () => {
  const value = useContext(MarketplaceContext);
  if (!value) throw new Error("useMarketplace must be used inside the marketplace console");
  return value;
};
