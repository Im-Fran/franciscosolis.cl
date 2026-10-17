import {useCallback, useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {CaretRight, FileText} from "@phosphor-icons/react";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {CrashReport} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";

const PAGE_SIZE = 10;

const preClass =
  "max-h-96 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre text-neutral-300";

/** One occurrence: where, when, the message, and the stack — the first one open, the rest on demand. */
const ReportItem = ({report, initiallyOpen}: {report: CrashReport; initiallyOpen: boolean}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const [open, setOpen] = useState(initiallyOpen);
  const [showContext, setShowContext] = useState(false);
  const detailsId = useId();
  const language = i18n.language;
  const context = report.context && Object.keys(report.context).length > 0 ? JSON.stringify(report.context, null, 2) : null;
  const device = installationLabel({
    alias: report.installation_alias,
    hostname: report.installation_hostname,
    device_id: report.installation_id,
  });

  return (
    <li className="border-b border-neutral-800/70 py-4 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <Link to={customAppsRoute.installation(report.installation_id)} className="text-text hover:underline">
            {device}
          </Link>
          {report.app_version && <span className="font-mono text-[12px] text-neutral-500">v{report.app_version}</span>}
          {report.kind && (
            <span className="rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-800/50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-300">
              {report.kind}
            </span>
          )}
        </p>
        <time dateTime={report.occurred_at} title={report.occurred_at} className="shrink-0 text-xs text-neutral-500">
          {formatDateTime(report.occurred_at, language)}
          <span className="text-neutral-600"> · {formatLastSeen(report.occurred_at, language)}</span>
        </time>
      </div>
      {report.message && <p className="mt-1.5 font-mono text-[12.5px] break-words whitespace-pre-wrap text-neutral-200">{report.message}</p>}
      <div className="mt-1.5 flex flex-wrap gap-4 text-[12px] text-neutral-500">
        {report.stack && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={`${detailsId}-stack`}
            className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-text"
          >
            <CaretRight size={12} className={cn("transition-transform", open && "rotate-90")} aria-hidden="true" />
            {open ? t("crashes.hide_stack") : t("crashes.show_stack")}
          </button>
        )}
        {context && (
          <button
            type="button"
            onClick={() => setShowContext((value) => !value)}
            aria-expanded={showContext}
            aria-controls={`${detailsId}-context`}
            className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-text"
          >
            <CaretRight size={12} className={cn("transition-transform", showContext && "rotate-90")} aria-hidden="true" />
            {showContext ? t("crashes.hide_context") : t("crashes.show_context")}
          </button>
        )}
      </div>
      {open && report.stack && (
        <pre id={`${detailsId}-stack`} className={cn(preClass, "mt-2")}>
          {report.stack}
        </pre>
      )}
      {showContext && context && (
        <pre id={`${detailsId}-context`} className={cn(preClass, "mt-2")}>
          {context}
        </pre>
      )}
    </li>
  );
};

/** Every report behind one crash group, newest first. */
export const CrashReports = ({crashId}: {crashId: string}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const [offset, setOffset] = useState(0);
  const reports = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.crashes.reports(crashId, {limit: PAGE_SIZE, offset}, signal),
      [crashId, offset],
    ),
  );
  const rows = reports.data?.data ?? [];

  return (
    <Panel title={t("custom_apps:crashes.reports_title")} description={t("custom_apps:crashes.reports_description")}>
      <PanelState loading={reports.loading && !reports.data} error={reports.error} onRetry={reports.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState icon={<FileText size={28} />} title={t("custom_apps:crashes.reports_empty")} />
        ) : (
          <ul className={reports.loading ? "opacity-60 transition-opacity" : undefined}>
            {rows.map((report, index) => (
              <ReportItem key={report.id} report={report} initiallyOpen={offset === 0 && index === 0} />
            ))}
          </ul>
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={reports.data?.pagination.total}
          onChange={setOffset}
          disabled={reports.loading}
        />
      </PanelState>
    </Panel>
  );
};
