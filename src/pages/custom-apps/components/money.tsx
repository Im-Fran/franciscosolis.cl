import {useTranslation} from "react-i18next";
import {formatMoney} from "@/lib/custom-apps/format.ts";
import {formatClpEstimate, ufToClp, useUfValue} from "@/lib/custom-apps/uf.ts";
import {useUfValueLabel} from "@/pages/custom-apps/components/use-money.ts";

/**
 * An amount in a contract's currency. In UF it carries its approximate peso value
 * (`UF 12,5 ≈ $474.312`) at today's UF, and says which value in a tooltip. The equivalent is an
 * estimate and is only ever drawn when the UF could be read: without it the amount stands alone.
 */

export const Money = ({amount, currency, className}: {amount: number | null | undefined; currency: string; className?: string}) => {
  const {i18n} = useTranslation("custom_apps");
  const uf = useUfValue(currency === "UF");
  const label = useUfValueLabel();
  const text = formatMoney(amount, currency, i18n.language);
  if (text === null) return null;
  if (currency !== "UF" || !uf || amount === null || amount === undefined) return <>{text}</>;

  return (
    <span title={label(uf)} className={className}>
      {text} <span className="text-neutral-500">≈ {formatClpEstimate(ufToClp(amount, uf))}</span>
    </span>
  );
};

/** A line under an amount field: what the UF typed so far comes to in pesos, and at which UF. */
export const UfPreview = ({amount, currency}: {amount: number; currency: string}) => {
  const {t} = useTranslation("custom_apps");
  const uf = useUfValue(currency === "UF");
  const label = useUfValueLabel();
  if (currency !== "UF" || !uf || !Number.isFinite(amount)) return null;
  return (
    <p className="text-xs text-neutral-400" title={label(uf)}>
      {t("money.preview", {amount: formatClpEstimate(ufToClp(amount, uf))})} · {label(uf)}
    </p>
  );
};
