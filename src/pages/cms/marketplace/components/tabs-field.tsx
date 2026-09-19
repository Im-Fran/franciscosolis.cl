import {useTranslation} from "react-i18next";
import {Lock} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import type {TabDefinition} from "@/lib/marketplace/types.ts";

/**
 * Which tabs a product turns on.
 *
 * This is the only thing about a page's shape an editor gets to decide, and it is a checklist
 * rather than a layout builder on purpose: every product draws from the same four tabs, so a
 * dozen pages read as one product family instead of a dozen sites.
 *
 * Overview is shown and locked rather than hidden. It is always on — the service forces it into the
 * list whatever is sent — and a checkbox that silently cannot be unticked is more honest than a tab
 * that is simply missing from the list of tabs.
 */
export type TabsFieldProps = {
  /** The tabs the service advertises, in its own order. Not a list this file keeps. */
  available: TabDefinition[];
  value: string[];
  onChange: (tabs: string[]) => void;
  disabled?: boolean;
};

const REQUIRED_TAB = "overview";

export const TabsField = ({available, value, onChange, disabled}: TabsFieldProps) => {
  const {t} = useTranslation(["cms_marketplace", "product"]);

  const toggle = (key: string, on: boolean) => {
    if (key === REQUIRED_TAB) return;
    /* Rebuilt from the service's own order rather than by appending, so ticking a tab back on puts
       it where it was instead of at the end. */
    const next = available
      .map((tab) => tab.key)
      .filter((tabKey) => (tabKey === key ? on : value.includes(tabKey)));
    onChange(next);
  };

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {available.map((tab) => {
        const required = tab.key === REQUIRED_TAB;
        const checked = required || value.includes(tab.key);
        const id = `pages-tab-${tab.key}`;

        return (
          <li key={tab.key}>
            <label
              htmlFor={id}
              className={cn(
                "flex h-full cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-3 transition-colors",
                checked ? "border-accent-700 bg-accent-900/30" : "border-neutral-800 hover:border-neutral-700",
                (disabled || required) && "cursor-default",
              )}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={disabled || required}
                onChange={(event) => toggle(tab.key, event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm text-text">
                  {t(`product:tabs.${tab.key}`, {defaultValue: tab.name})}
                  {required && <Lock size={12} className="text-neutral-500"/>}
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-neutral-500">
                  {tab.description}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
};
