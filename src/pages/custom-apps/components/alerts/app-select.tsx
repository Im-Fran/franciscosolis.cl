import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Select} from "@/components/ui/input.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";

/**
 * Every app, alphabetically, for the alert screens — which cross apps, unlike every other screen of
 * the panel. One page of 200 holds the inventory, as the company picker assumes for clients.
 */
export const AppSelect = ({
  id,
  value,
  onChange,
  emptyLabel,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  disabled?: boolean;
  className?: string;
}) => {
  const {t} = useTranslation("admin");
  const apps = useResource(useCallback((signal: AbortSignal) => customAppsApi.apps.list({limit: 200}, signal), []));
  const rows = [...(apps.data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Select
      id={id}
      value={value}
      disabled={disabled || apps.loading}
      aria-label={id ? undefined : emptyLabel}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <option value="">{apps.loading ? t("common.loading") : emptyLabel}</option>
      {rows.map((app) => (
        <option key={app.id} value={app.id}>
          {app.company ? `${app.name} · ${app.company.trade_name || app.company.legal_name}` : app.name}
        </option>
      ))}
    </Select>
  );
};
