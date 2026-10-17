import {useTranslation} from "react-i18next";
import {Alert} from "@/components/ui/alert.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {formatNumber, formatPercent} from "@/lib/custom-apps/format.ts";
import type {Release} from "@/lib/custom-apps/types.ts";

/**
 * Why a release is in the status it is in, in words. The automatic pause is the one that matters
 * most: nobody clicked anything, so the page has to say which rate crossed which threshold over how
 * many devices — and that resuming without fixing the cause only pauses it again.
 */
export const ReleaseStatusReason = ({release}: {release: Release}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const language = i18n.language;
  const reason = release.status_reason;
  const when = formatDateTime(release.status_changed_at, language) ?? "—";
  const by = typeof reason?.by === "string" && reason.by ? reason.by : t("audit.system");
  const note = typeof reason?.reason === "string" && reason.reason && !reason.automatic ? reason.reason : null;
  const rolledBackTo = typeof reason?.rolled_back_to === "string" ? reason.rolled_back_to : null;

  const noteLine = note && (
    <span className="mt-1.5 block">
      {t("release.status_reason.note")} <q className="italic">{note}</q>
    </span>
  );

  if (release.status === "paused" && reason?.automatic) {
    const kind = reason.reason === "crash_rate" ? "crash_rate" : "rollback_rate";
    return (
      <Alert tone="error" title={t("release.status_reason.auto_title", {date: when})}>
        {t(`release.status_reason.auto_${kind}`, {
          rate: formatPercent(reason.rate, language, 1) ?? "—",
          threshold: formatPercent(reason.threshold, language) ?? "—",
          sample: formatNumber(reason.sample, language) ?? "—",
          count: reason.sample ?? 0,
        })}
        <span className="mt-1.5 block">{t("release.status_reason.auto_after")}</span>
      </Alert>
    );
  }

  if (release.status === "paused") {
    return (
      <Alert tone="info" title={t("release.status_reason.paused_title", {by, date: when})}>
        {t("release.status_reason.paused_body")}
        {noteLine}
      </Alert>
    );
  }

  if (release.status === "withdrawn") {
    return (
      <Alert tone="error" title={t("release.status_reason.withdrawn_title", {by, date: when})}>
        {rolledBackTo
          ? t("release.status_reason.withdrawn_by_rollback", {version: rolledBackTo})
          : t("release.status_reason.withdrawn_body")}
        {noteLine}
      </Alert>
    );
  }

  if (release.status === "published" && rolledBackTo === release.version) {
    return (
      <Alert tone="info" title={t("release.status_reason.rolled_back_title", {by, date: when})}>
        {t("release.status_reason.rolled_back_body")}
        {noteLine}
      </Alert>
    );
  }

  return null;
};
