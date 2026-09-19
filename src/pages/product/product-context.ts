import {createContext, useContext} from "react";
import type {Product} from "@/lib/marketplace/types.ts";

export type ProductContextValue = {
  /** The published product this whole subtree is about. Never null below the layout's gate. */
  product: Product;
  /** Its slug, pulled out because every route helper below takes it. */
  slug: string;
};

export const ProductContext = createContext<ProductContextValue | null>(null);

/**
 * The product the current tab belongs to.
 *
 * Loaded once by the layout rather than per tab: the banner, the tab bar and the tab body all need
 * it, and four screens each fetching the same row would flash the header on every tab change.
 */
export const useProductPage = () => {
  const value = useContext(ProductContext);
  if (!value) throw new Error("useProductPage must be used inside the product layout");
  return value;
};
