import type {Icon} from "@phosphor-icons/react";
import {
  CircleHalfTilt,
  Eye,
  FilmSlate,
  LinkSimple,
  Monitor,
  Moon,
  Palette,
  Sun,
  TextAa,
  TextAlignJustify,
  Translate,
} from "@phosphor-icons/react";
import {FONT_SCALES, LANGUAGES, MOTIONS, THEMES, type A11yPreferences} from "@/lib/a11y";

/**
 * The panel and the command palette are two views of this one table. Adding a preference here
 * gives it a row in the modal and a command in the palette at the same time, which is the whole
 * point — the two can never drift apart and offer different sets of controls.
 *
 * Translation keys are relative to the `a11y` namespace.
 */

export type ChoiceKey = "theme" | "fontScale" | "motion" | "language";
export type ToggleKey = "highContrast" | "underlineLinks" | "readableSpacing";

export type ChoiceSetting<K extends ChoiceKey = ChoiceKey> = {
  kind: "choice";
  key: K;
  icon: Icon;
  /** Extra terms the palette should match on, beyond the translated labels. */
  keywords: string;
  options: ReadonlyArray<A11yPreferences[K]>;
};

export type ToggleSetting = {
  kind: "toggle";
  key: ToggleKey;
  icon: Icon;
  keywords: string;
};

export type A11ySetting =
  | ChoiceSetting<"theme">
  | ChoiceSetting<"fontScale">
  | ChoiceSetting<"motion">
  | ChoiceSetting<"language">
  | ToggleSetting;

export const A11Y_SETTINGS: readonly A11ySetting[] = [
  {kind: "choice", key: "theme", icon: Palette, keywords: "tema theme color colour dark light claro oscuro daltonismo colorblind contraste", options: THEMES},
  {kind: "choice", key: "fontScale", icon: TextAa, keywords: "texto text size tamano tamaño font letra zoom fuente", options: FONT_SCALES},
  {kind: "choice", key: "motion", icon: FilmSlate, keywords: "animacion animación animation movimiento motion reducir reduce", options: MOTIONS},
  {kind: "choice", key: "language", icon: Translate, keywords: "idioma language lenguaje espanol español ingles inglés spanish english", options: LANGUAGES},
  {kind: "toggle", key: "highContrast", icon: CircleHalfTilt, keywords: "contraste contrast alto high legibilidad"},
  {kind: "toggle", key: "underlineLinks", icon: LinkSimple, keywords: "enlaces links subrayar underline subrayado"},
  {kind: "toggle", key: "readableSpacing", icon: TextAlignJustify, keywords: "espaciado spacing interlineado dislexia dyslexia lectura reading"},
] as const;

/** Icons for the individual theme options, the one choice where the option itself reads as a picture. */
export const THEME_OPTION_ICON: Record<A11yPreferences["theme"], Icon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
  daltonism: Eye,
};

/** Relative "Aa" preview size per step, so the text-size chips show what they do. */
export const FONT_SCALE_PREVIEW: Record<A11yPreferences["fontScale"], string> = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[15px]",
  xl: "text-[18px]",
};

/** Any value any preference can hold, which is what a table walked generically hands back. */
export type SettingValue = A11yPreferences[keyof A11yPreferences];

export const settingLabelKey = (key: ChoiceKey | ToggleKey) => `a11y:settings.${key}.label`;
export const settingHintKey = (key: ChoiceKey | ToggleKey) => `a11y:settings.${key}.hint`;
export const optionLabelKey = (key: ChoiceKey, value: string) => `a11y:settings.${key}.options.${value}`;
