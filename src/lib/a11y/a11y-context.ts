import {createContext, useContext} from "react";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SYSTEM,
  type A11yPreferences,
  type ResolvedMotion,
  type ResolvedTheme,
  type SystemPreferences,
} from "@/lib/a11y/preferences.ts";

export type A11yContextValue = {
  preferences: A11yPreferences;
  system: SystemPreferences;
  /** What `theme` actually resolves to right now — `system` already collapsed to light or dark. */
  theme: ResolvedTheme;
  /** What `motion` actually resolves to right now. Animations should branch on this, not on the raw value. */
  motion: ResolvedMotion;
  setPreference: <K extends keyof A11yPreferences>(key: K, value: A11yPreferences[K]) => void;
  reset: () => void;
  /** Sends a message to the panel's live region, so a change made from the palette is announced. */
  announce: (message: string) => void;
};

export const A11yContext = createContext<A11yContextValue>({
  preferences: DEFAULT_PREFERENCES,
  system: DEFAULT_SYSTEM,
  theme: "dark",
  motion: "full",
  setPreference: () => {},
  reset: () => {},
  announce: () => {},
});

export const useA11y = () => useContext(A11yContext);
