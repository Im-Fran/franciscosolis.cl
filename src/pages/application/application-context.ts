import {createContext, useContext} from "react";
import type {Application} from "@/lib/pages/types.ts";

export type ApplicationContextValue = {
  /** The published application this whole subtree is about. Never null below the layout's gate. */
  application: Application;
  /** Its slug, pulled out because every route helper below takes it. */
  slug: string;
};

export const ApplicationContext = createContext<ApplicationContextValue | null>(null);

/**
 * The application the current tab belongs to.
 *
 * Loaded once by the layout rather than per tab: the banner, the tab bar and the tab body all need
 * it, and four screens each fetching the same row would flash the header on every tab change.
 */
export const useApplicationPage = () => {
  const value = useContext(ApplicationContext);
  if (!value) throw new Error("useApplicationPage must be used inside the application layout");
  return value;
};
