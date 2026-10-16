import {useTranslation} from "react-i18next";
import {Select} from "@/components/ui/input.tsx";
import type {InstallationSummary} from "@/lib/custom-apps/types.ts";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";

export const InstallationSelect = ({
  id,
  value,
  onChange,
  installations,
  loading,
  disabled,
  invalid,
  emptyLabel,
  includeRevoked = false,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  installations: InstallationSummary[];
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** The empty option: "pick one" in a form, "every installation" in a filter. */
  emptyLabel: string;
  /** A revoked device cannot be targeted, but its old log entries can still be filtered on. */
  includeRevoked?: boolean;
  className?: string;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const rows = installations
    .filter((row) => includeRevoked || row.status !== "revoked")
    .sort((a, b) => installationLabel(a).localeCompare(installationLabel(b)));

  return (
    <Select
      id={id}
      value={value}
      disabled={disabled || loading}
      aria-invalid={invalid}
      aria-label={id ? undefined : emptyLabel}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <option value="">{loading ? t("admin:common.loading") : emptyLabel}</option>
      {rows.map((row) => (
        <option key={row.id} value={row.id}>
          {installationLabel(row)}
          {row.status === "revoked" ? ` (${t("custom_apps:lifecycle.revoked")})` : ""}
        </option>
      ))}
    </Select>
  );
};
