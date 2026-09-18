import {useTranslation} from "react-i18next";
import {PersonSimpleCircle} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import {useAccessibilityUi} from "@/components/a11y/accessibility-ui-context.ts";
import {shortcutLabel} from "@/components/a11y/shortcut.ts";

/** The footer's way into the accessibility panel. The palette's chord is offered alongside it. */
export const AccessibilityLauncher = ({className}: {className?: string}) => {
  const {t} = useTranslation();
  const {openPanel} = useAccessibilityUi();

  return (
    <button
      type="button"
      onClick={openPanel}
      title={t("a11y:open_hint")}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-neutral-800",
        "px-3 py-1.5 text-neutral-400 transition-colors hover:border-neutral-700 hover:text-text",
        className,
      )}
    >
      <PersonSimpleCircle size={16} weight="bold"/>
      {t("a11y:open")}
      <kbd className="ml-1 hidden rounded-[var(--radius-sm)] border border-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500 sm:inline">
        {shortcutLabel()}
      </kbd>
    </button>
  );
};
