import {useTranslation} from "react-i18next";
import {cn} from "@/lib/utils.ts";
import type {SaleSource} from "@/lib/pages/types.ts";

/**
 * The two labels every sales screen repeats: how the money arrived, and which account took it.
 *
 * They live together because they answer the same question from two sides — "is this real money,
 * and did a provider handle it" — and because a screen that spelled either of them differently in
 * two places would be a screen somebody has to cross-check.
 */

const SOURCE_TONES: Record<string, string> = {
  /* A card payment is the only one a provider can vouch for. */
  mercadopago: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  cash: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  bank_transfer: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  /* No money changed hands, so it reads as a note rather than as takings. */
  gift: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
  other: "border-neutral-700 bg-neutral-800/60 text-neutral-300",
};

const chip = "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium";

export const SourceBadge = ({source, className}: {source: SaleSource | string; className?: string}) => {
  const {t} = useTranslation(["cms_pages"]);

  return (
    <span className={cn(chip, SOURCE_TONES[source] ?? SOURCE_TONES.other, className)}>
      {t(`cms_pages:sales.sources.${source}`, {defaultValue: source})}
    </span>
  );
};

/**
 * Which MercadoPago account the money went to.
 *
 * Only ever rendered for `sandbox`: a live sale is the normal case and a badge on every row of a
 * production screen is noise. A test payment sitting in a list of real ones is the thing that has
 * to be impossible to miss, which is why this one is loud.
 */
export const EnvironmentBadge = ({environment, className}: {environment?: string; className?: string}) => {
  const {t} = useTranslation(["cms_pages"]);
  if (environment !== "sandbox") return null;

  return (
    <span className={cn(chip, "border-amber-500/40 bg-amber-500/10 text-amber-300", className)}>
      {t("cms_pages:sales.sandbox")}
    </span>
  );
};
