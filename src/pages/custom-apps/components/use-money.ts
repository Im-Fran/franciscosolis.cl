import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {formatDay, formatMoney} from "@/lib/custom-apps/format.ts";
import {formatClpEstimate, formatUfValue, ufToClp, useUfValue} from "@/lib/custom-apps/uf.ts";
import type {UfValue} from "@/lib/custom-apps/uf.ts";

/** `Valor UF del 2 nov 2026: $37.945,00`, for a tooltip or a help line. */
export const useUfValueLabel = () => {
  const {t, i18n} = useTranslation("custom_apps");
  return useCallback(
    (uf: UfValue) => t("money.uf_value", {date: formatDay(uf.date, i18n.language), value: formatUfValue(uf.value)}),
    [t, i18n.language],
  );
};

/** The same text as a string, for copy that interpolates an amount (`… a UF 1,2 ≈ $45.000 por hora`). */
export const useMoneyText = (currency: string) => {
  const {i18n} = useTranslation("custom_apps");
  const uf = useUfValue(currency === "UF");
  return useCallback(
    (amount: number | null | undefined) => {
      const text = formatMoney(amount, currency, i18n.language);
      if (text === null || currency !== "UF" || !uf || amount === null || amount === undefined) return text;
      return `${text} ≈ ${formatClpEstimate(ufToClp(amount, uf))}`;
    },
    [currency, i18n.language, uf],
  );
};
