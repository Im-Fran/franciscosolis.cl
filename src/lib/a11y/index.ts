export {A11yProvider} from "@/lib/a11y/a11y-provider.tsx";
export {A11yContext, useA11y} from "@/lib/a11y/a11y-context.ts";
export type {A11yContextValue} from "@/lib/a11y/a11y-context.ts";
export {
  A11Y_STORAGE_KEY,
  DEFAULT_PREFERENCES,
  FONT_SCALES,
  FONT_SCALE_RATIO,
  LANGUAGES,
  LOCALE_STORAGE_KEY,
  MOTIONS,
  THEMES,
  readPreferences,
  resolveMotion,
  resolveTheme,
} from "@/lib/a11y/preferences.ts";
export type {
  A11yPreferences,
  FontScale,
  Language,
  Motion,
  ResolvedMotion,
  ResolvedTheme,
  SystemPreferences,
  Theme,
} from "@/lib/a11y/preferences.ts";
