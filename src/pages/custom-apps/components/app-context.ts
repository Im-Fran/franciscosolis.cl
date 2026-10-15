import {createContext, useContext} from "react";
import type {App} from "@/lib/custom-apps/types.ts";

export type AppContextValue = {
  app: App;
  /** Reloads the app for every tab at once — after a save, or after the kill switch changed. */
  reload: () => void;
  /** Hands a fresh record straight in, when a write already answered with one. */
  replace: (app: App) => void;
};

export const AppContext = createContext<AppContextValue | null>(null);

/** The app an app tab is about, loaded once by `AppLayout` above the tabs. */
export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside <AppLayout>");
  return value;
};
