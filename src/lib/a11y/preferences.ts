/**
 * Accessibility preferences — the single source of truth for what the panel and the command
 * palette can change, how each value is stored, and how it reaches the DOM.
 *
 * Everything in this file is pure and framework-free on purpose: the boot script in index.html
 * mirrors `resolve*` + `applyPreferences` in plain JS so the stored preferences are on <html>
 * before the first paint. Keep the two in sync — the data attributes are the contract.
 */

export const A11Y_STORAGE_KEY = "fs:a11y";
/** Mirrored on every write so the older `locale` key keeps working for anything still reading it. */
export const LOCALE_STORAGE_KEY = "locale";

export const THEMES = ["light", "dark", "system", "daltonism"] as const;
export const FONT_SCALES = ["sm", "md", "lg", "xl"] as const;
export const MOTIONS = ["system", "full", "reduced"] as const;
export const LANGUAGES = ["es", "en"] as const;

export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "system">;
export type FontScale = (typeof FONT_SCALES)[number];
export type Motion = (typeof MOTIONS)[number];
export type ResolvedMotion = Exclude<Motion, "system">;
export type Language = (typeof LANGUAGES)[number];

export type A11yPreferences = {
  /** `daltonism` is a colour-blind-safe palette, so it sits alongside light/dark rather than over it. */
  theme: Theme;
  fontScale: FontScale;
  motion: Motion;
  language: Language;
  /** Pushes text and borders towards the strongest contrast the palette allows. */
  highContrast: boolean;
  /** Underlines links everywhere, so they never rely on colour alone (WCAG 1.4.1). */
  underlineLinks: boolean;
  /** Line height, letter and word spacing at the WCAG 1.4.12 minimums. */
  readableSpacing: boolean;
};

/** Root font size multipliers. `md` is the design's 16px baseline. */
export const FONT_SCALE_RATIO: Record<FontScale, number> = {
  sm: 0.875,
  md: 1,
  lg: 1.15,
  xl: 1.3,
};

export const DEFAULT_PREFERENCES: A11yPreferences = {
  theme: "system",
  fontScale: "md",
  motion: "system",
  language: "en",
  highContrast: false,
  underlineLinks: false,
  readableSpacing: false,
};

export type SystemPreferences = {
  prefersDark: boolean;
  prefersReducedMotion: boolean;
};

export const DEFAULT_SYSTEM: SystemPreferences = {
  prefersDark: true,
  prefersReducedMotion: false,
};

export const resolveTheme = (theme: Theme, system: SystemPreferences): ResolvedTheme =>
  theme === "system" ? (system.prefersDark ? "dark" : "light") : theme;

export const resolveMotion = (motion: Motion, system: SystemPreferences): ResolvedMotion =>
  motion === "system" ? (system.prefersReducedMotion ? "reduced" : "full") : motion;

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);

/** Narrows whatever is in storage back onto the defaults, so a stale or hand-edited blob is harmless. */
export const parsePreferences = (raw: unknown): A11yPreferences => {
  if (typeof raw !== "object" || raw === null) return DEFAULT_PREFERENCES;
  const value = raw as Partial<Record<keyof A11yPreferences, unknown>>;

  return {
    theme: isOneOf(THEMES, value.theme) ? value.theme : DEFAULT_PREFERENCES.theme,
    fontScale: isOneOf(FONT_SCALES, value.fontScale) ? value.fontScale : DEFAULT_PREFERENCES.fontScale,
    motion: isOneOf(MOTIONS, value.motion) ? value.motion : DEFAULT_PREFERENCES.motion,
    language: isOneOf(LANGUAGES, value.language) ? value.language : DEFAULT_PREFERENCES.language,
    highContrast: value.highContrast === true,
    underlineLinks: value.underlineLinks === true,
    readableSpacing: value.readableSpacing === true,
  };
};

/** The browser's own language, used the first time someone lands without a stored choice. */
const detectLanguage = (): Language => {
  if (typeof navigator === "undefined") return DEFAULT_PREFERENCES.language;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  const match = tags.find((tag) => isOneOf(LANGUAGES, tag?.slice(0, 2).toLowerCase()));
  return (match?.slice(0, 2).toLowerCase() as Language | undefined) ?? DEFAULT_PREFERENCES.language;
};

export const readPreferences = (): A11yPreferences => {
  if (typeof localStorage === "undefined") return DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem(A11Y_STORAGE_KEY);
    if (stored) return parsePreferences(JSON.parse(stored));

    /* No accessibility blob yet: honour the legacy `locale` key, then the browser. */
    const locale = localStorage.getItem(LOCALE_STORAGE_KEY);
    return {
      ...DEFAULT_PREFERENCES,
      language: isOneOf(LANGUAGES, locale) ? locale : detectLanguage(),
    };
  } catch {
    /* Private mode, a disabled storage partition, or malformed JSON — the defaults still work. */
    return DEFAULT_PREFERENCES;
  }
};

export const writePreferences = (preferences: A11yPreferences) => {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(preferences));
    localStorage.setItem(LOCALE_STORAGE_KEY, preferences.language);
  } catch {
    /* Storage being unavailable must not stop the preference from applying for this visit. */
  }
};

export const readSystemPreferences = (): SystemPreferences => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return DEFAULT_SYSTEM;

  return {
    prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
};

/**
 * Writes the resolved preferences onto <html>. Every knob is a data attribute so the styling lives
 * in CSS (see src/lib/main.css) and nothing has to re-render for a preference to take effect.
 */
export const applyPreferences = (
  preferences: A11yPreferences,
  system: SystemPreferences,
  root: HTMLElement,
) => {
  const theme = resolveTheme(preferences.theme, system);
  const motion = resolveMotion(preferences.motion, system);

  root.dataset.fsTheme = theme;
  root.dataset.fsFontScale = preferences.fontScale;
  root.dataset.fsMotion = motion;
  root.dataset.fsContrast = preferences.highContrast ? "high" : "normal";
  root.dataset.fsLinks = preferences.underlineLinks ? "underlined" : "default";
  root.dataset.fsSpacing = preferences.readableSpacing ? "readable" : "default";
  root.style.setProperty("--fs-font-scale", `${FONT_SCALE_RATIO[preferences.fontScale]}`);
  root.lang = preferences.language;
};
