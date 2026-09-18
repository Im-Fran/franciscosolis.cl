import {useTranslation} from "react-i18next";
import {WarningCircleIcon} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";

/**
 * What a landing section shows while the CMS is answering, and when it does not.
 *
 * The page used to be static, so every section rendered instantly and could not fail. Reading from
 * an API buys editable content at the cost of both, and the shape of that cost is a deliberate
 * choice: a section that is still loading shows placeholder cards rather than collapsing — so the
 * page does not reflow under the reader as each section lands — and a section that failed says so
 * in one line instead of disappearing, which would leave a heading with nothing under it and no
 * explanation for why.
 *
 * A failure is scoped to its own section on purpose. The three sections read different collections,
 * and one of them being unreachable is not a reason to blank the other two.
 */

export type SectionSkeletonProps = {
  /** How many placeholders to draw. Match the section's usual content so the page settles evenly. */
  count?: number;
  className?: string;
  itemClassName?: string;
};

export const SectionSkeleton = ({count = 3, className, itemClassName}: SectionSkeletonProps) => {
  const {t} = useTranslation();

  return (
    <div className={cn("flex gap-6", className)} role="status" aria-label={t("common:loading")}>
      {Array.from({length: count}, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn(
            "h-40 flex-1 animate-pulse rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/60",
            itemClassName,
          )}
        />
      ))}
    </div>
  );
};

export type SectionErrorProps = {
  /** The failure `useResource` described: `network` when the service was unreachable. */
  error: string;
  onRetry?: () => void;
};

export const SectionError = ({error, onRetry}: SectionErrorProps) => {
  const {t} = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-6 text-sm text-neutral-400">
      <WarningCircleIcon size={20} className="text-accent-300" />
      <p className="flex-1 min-w-[220px]">
        {error === "network" ? t("common:content_unreachable") : t("common:content_failed")}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-accent-300 underline underline-offset-4"
        >
          {t("common:retry")}
        </button>
      )}
    </div>
  );
};
