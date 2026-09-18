import {useTranslation} from "react-i18next";
import {ArrowCounterClockwise, Command} from "@phosphor-icons/react";
import {Modal} from "@/components/ui/modal.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {cn} from "@/lib/utils.ts";
import {useA11y, type A11yPreferences} from "@/lib/a11y";
import {
  A11Y_SETTINGS,
  FONT_SCALE_PREVIEW,
  optionLabelKey,
  settingHintKey,
  settingLabelKey,
  THEME_OPTION_ICON,
  type ChoiceSetting,
  type SettingValue,
  type ToggleSetting,
} from "@/components/a11y/a11y-settings.ts";
import {shortcutLabel} from "@/components/a11y/shortcut.ts";

const chip =
  "flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 " +
  "text-sm transition-colors select-none";
const chipIdle = "border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-text";
const chipActive = "border-accent bg-accent-900/40 text-accent-300";

/**
 * One preference, as a set of chips. Built on real radio inputs rather than `role="radio"` divs,
 * so arrow-key navigation, the group's accessible name and the checked state all come from the
 * platform instead of being re-implemented.
 */
const ChoiceRow = ({setting}: {setting: ChoiceSetting}) => {
  const {t} = useTranslation();
  const {preferences, setPreference, announce} = useA11y();
  const label = t(settingLabelKey(setting.key));
  const current = preferences[setting.key];
  /* See useA11yCommands: the table's per-row typing collapses when it is walked generically. */
  const apply = setPreference as (key: keyof A11yPreferences, value: SettingValue) => void;

  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-1 flex items-center gap-2 text-sm font-medium text-text">
        <setting.icon size={16} className="text-accent-300"/>
        {label}
      </legend>
      <p className="mb-3 text-xs leading-relaxed text-neutral-500">{t(settingHintKey(setting.key))}</p>

      <div className={cn("grid gap-2", setting.options.length > 2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        {setting.options.map((option) => {
          const active = current === option;
          const optionLabel = t(optionLabelKey(setting.key, option));
          const OptionIcon = setting.key === "theme" ? THEME_OPTION_ICON[option as A11yPreferences["theme"]] : null;

          return (
            <label key={option} className={cn(chip, active ? chipActive : chipIdle)}>
              <input
                type="radio"
                name={`fs-a11y-${setting.key}`}
                value={option}
                checked={active}
                onChange={() => {
                  apply(setting.key, option);
                  announce(t("a11y:changed", {setting: label, value: optionLabel}));
                }}
                className="sr-only"
              />
              {OptionIcon && <OptionIcon size={16} weight={active ? "fill" : "regular"}/>}
              {setting.key === "fontScale" && (
                <span aria-hidden className={cn("font-medium", FONT_SCALE_PREVIEW[option as A11yPreferences["fontScale"]])}>
                  Aa
                </span>
              )}
              <span>{optionLabel}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

/** A single on/off preference, as a switch with its explanation. */
const ToggleRow = ({setting}: {setting: ToggleSetting}) => {
  const {t} = useTranslation();
  const {preferences, setPreference, announce} = useA11y();
  const label = t(settingLabelKey(setting.key));
  const checked = preferences[setting.key];

  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium text-text">
          <setting.icon size={16} className="text-accent-300"/>
          {label}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-neutral-500">{t(settingHintKey(setting.key))}</span>
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => {
          setPreference(setting.key, !checked);
          announce(t("a11y:changed", {setting: label, value: t(checked ? "a11y:disabled" : "a11y:enabled")}));
        }}
        className={cn(
          "mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
          checked ? "border-accent bg-accent-800/70" : "border-neutral-700 bg-neutral-800",
        )}
      >
        <span
          className={cn(
            "mx-0.5 block size-4 rounded-full transition-transform",
            checked ? "translate-x-5 bg-accent-300" : "translate-x-0 bg-neutral-500",
          )}
        />
      </button>
    </div>
  );
};

export type AccessibilityPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Lets the panel hand off to the palette, so the two entry points are reachable from each other. */
  onOpenPalette: () => void;
};

export const AccessibilityPanel = ({open, onClose, onOpenPalette}: AccessibilityPanelProps) => {
  const {t} = useTranslation();
  const {reset, announce} = useA11y();

  return (
    <Modal open={open} onClose={onClose} title={t("a11y:title")} className="max-w-xl">
      <p className="-mt-2 mb-6 text-sm leading-relaxed text-neutral-400">{t("a11y:description")}</p>

      <div className="flex flex-col gap-7">
        {A11Y_SETTINGS.map((setting) =>
          setting.kind === "toggle"
            ? <ToggleRow key={setting.key} setting={setting}/>
            : <ChoiceRow key={setting.key} setting={setting}/>,
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-neutral-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onOpenPalette}
          className="inline-flex items-center gap-2 text-xs text-neutral-500 transition-colors hover:text-text"
        >
          <Command size={14}/>
          {t("a11y:shortcut_hint", {shortcut: shortcutLabel()})}
        </button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            reset();
            announce(t("a11y:reset_done"));
          }}
        >
          <ArrowCounterClockwise size={16}/>
          {t("a11y:reset")}
        </Button>
      </div>
    </Modal>
  );
};
