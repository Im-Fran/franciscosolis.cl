import {useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode} from "react";
import i18next from "i18next";
import {A11yContext, type A11yContextValue} from "@/lib/a11y/a11y-context.ts";
import {
  applyPreferences,
  readPreferences,
  readSystemPreferences,
  resolveMotion,
  resolveTheme,
  writePreferences,
  DEFAULT_PREFERENCES,
  type A11yPreferences,
  type SystemPreferences,
} from "@/lib/a11y/preferences.ts";

/** `matchMedia` in one place, with the older `addListener` fallback Safari needed until 14. */
const observeMedia = (query: string, onChange: (matches: boolean) => void) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};

  const media = window.matchMedia(query);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);

  onChange(media.matches);
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }
  media.addListener(listener);
  return () => media.removeListener(listener);
};

/**
 * Holds the visitor's accessibility preferences, keeps them on <html> and in localStorage, and
 * keeps the ones the OS also has an opinion about (colour scheme, reduced motion) in sync while
 * the tab is open.
 */
export const A11yProvider = ({children}: {children: ReactNode}) => {
  const [preferences, setPreferences] = useState<A11yPreferences>(readPreferences);
  const [system, setSystem] = useState<SystemPreferences>(readSystemPreferences);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => observeMedia("(prefers-color-scheme: dark)", (prefersDark) =>
    setSystem((current) => (current.prefersDark === prefersDark ? current : {...current, prefersDark})),
  ), []);

  useEffect(() => observeMedia("(prefers-reduced-motion: reduce)", (prefersReducedMotion) =>
    setSystem((current) =>
      current.prefersReducedMotion === prefersReducedMotion ? current : {...current, prefersReducedMotion},
    ),
  ), []);

  /* Applied before paint so a preference change never shows a frame of the previous theme. */
  useLayoutEffect(() => {
    applyPreferences(preferences, system, document.documentElement);
  }, [preferences, system]);

  useEffect(() => {
    if (i18next.language === preferences.language) return;
    void i18next.changeLanguage(preferences.language);
  }, [preferences.language]);

  const setPreference = useCallback<A11yContextValue["setPreference"]>((key, value) => {
    setPreferences((current) => {
      if (current[key] === value) return current;
      const next = {...current, [key]: value};
      writePreferences(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    /* The language is a content choice rather than an accessibility one, so a reset keeps it. */
    setPreferences((current) => {
      const next = {...DEFAULT_PREFERENCES, language: current.language};
      writePreferences(next);
      return next;
    });
  }, []);

  const announce = useCallback((message: string) => {
    /* Cleared first so repeating the same message is still announced. */
    setAnnouncement("");
    window.requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  const value = useMemo<A11yContextValue>(() => ({
    preferences,
    system,
    theme: resolveTheme(preferences.theme, system),
    motion: resolveMotion(preferences.motion, system),
    setPreference,
    reset,
    announce,
  }), [preferences, system, setPreference, reset, announce]);

  return (
    <A11yContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </A11yContext.Provider>
  );
};
