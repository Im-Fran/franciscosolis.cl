import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {ArrowClockwise, EnvelopeSimple, PaperPlaneTilt} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {EMAIL_STATUSES} from "@/lib/cms/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {Segmented} from "@/pages/cms/email/email-segmented.tsx";
import {recipientsOf} from "@/pages/cms/email/email-shared.ts";
import type {Column} from "@/components/admin/data-table.tsx";
import type {EmailMessage, EmailStatus} from "@/lib/cms/types.ts";

const PAGE_SIZE = 25;

/** The empty string is the "no filter" option; the API simply gets no `status` parameter. */
type StatusFilter = EmailStatus | "";

/** The first two addresses, with the rest behind a count — a `to` of twenty cannot fit in a cell. */
const Recipients = ({message}: {message: EmailMessage}) => {
  const {t} = useTranslation(["cms_emails", "cms"]);
  const to = recipientsOf(message);

  if (to.length === 0) return <span className="text-neutral-600">{t("admin:common.none")}</span>;

  return (
    <span className="flex min-w-0 items-center gap-1.5" title={to.join(", ")}>
      <span className="truncate">{to.slice(0, 2).join(", ")}</span>
      {to.length > 2 && (
        <span className="shrink-0 rounded-[var(--radius-sm)] border border-neutral-700 px-1.5 py-0.5 text-[11px] text-neutral-400">
          {t("cms_emails:list.more_recipients", {n: to.length - 2})}
        </span>
      )}
    </span>
  );
};

/**
 * The delivery log: every message this CMS has handed to the mail provider, newest first.
 *
 * Nothing here is editable — a sent message is history — so the screen is a filter, a table and the
 * way into the compose form.
 */
export const EmailList = () => {
  const {t, i18n} = useTranslation(["cms_emails", "cms"]);
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>("");
  const [offset, setOffset] = useState(0);

  const emails = useResource(
    useCallback(
      (signal: AbortSignal) =>
        cmsApi.emails.list({status: status || undefined, limit: PAGE_SIZE, offset}, signal),
      [status, offset],
    ),
  );

  const rows = emails.data ?? [];
  const filtered = status !== "" || offset > 0;

  const columns: Column<EmailMessage>[] = [
    {
      key: "subject",
      header: t("cms_emails:list.columns.subject"),
      className: "max-w-[16rem] text-text",
      /* The row itself is clickable, but only this link is reachable from the keyboard — a table
         row cannot be a button without lying to a screen reader about what the table is. */
      cell: (row) => (
        <Link
          to={cmsRoute.emailItem(row.id)}
          onClick={(event) => event.stopPropagation()}
          className="block truncate transition-colors hover:text-accent-200"
        >
          {row.subject}
        </Link>
      ),
    },
    {
      key: "to",
      header: t("cms_emails:list.columns.recipients"),
      className: "max-w-[14rem]",
      cell: (row) => <Recipients message={row}/>,
    },
    {
      key: "status",
      header: t("cms_emails:list.columns.status"),
      cell: (row) => <StatusBadge status={row.status}/>,
    },
    {
      key: "template",
      header: t("cms_emails:list.columns.template"),
      hideBelowLg: true,
      cell: (row) =>
        row.template ? (
          <Link
            to={cmsRoute.templates}
            onClick={(event) => event.stopPropagation()}
            className="text-accent-300 transition-colors hover:text-accent-200"
          >
            {row.template}
          </Link>
        ) : (
          <span className="text-neutral-600">{t("cms_emails:list.inline_body")}</span>
        ),
    },
    {
      key: "created_at",
      header: t("cms_emails:list.columns.created"),
      hideBelowLg: true,
      className: "whitespace-nowrap text-neutral-500",
      cell: (row) => formatDateTime(row.created_at, i18n.language) ?? t("admin:common.none"),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("cms_emails:list.title")}
        description={t("cms_emails:list.description")}
        actions={
          <Button asChild>
            <Link to={cmsRoute.emailNew}>
              <PaperPlaneTilt size={16}/> {t("cms_emails:list.compose")}
            </Link>
          </Button>
        }
      />

      <Panel
        title={t("cms_emails:list.panel_title")}
        description={t("cms_emails:list.panel_description")}
        action={
          /* A queued message turns into `sent` or `failed` on the server, and nothing pushes that
             change to this tab. Polling in the background would spend requests on a screen nobody
             is watching most of the time, so the refresh is deliberate, obvious and cheap instead. */
          <Button variant="ghost" size="sm" onClick={emails.reload} disabled={emails.loading}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      >
        <div className="mb-5">
          <Segmented
            name="email-status"
            label={t("cms_emails:list.filter_label")}
            value={status}
            onChange={(next) => {
              setStatus(next);
              /* A page-two offset means nothing once the filter changes the result set. */
              setOffset(0);
            }}
            options={[
              {value: "" as StatusFilter, label: t("admin:common.filter_all")},
              ...EMAIL_STATUSES.map((value) => ({value: value as StatusFilter, label: t(`admin:status.${value}`)})),
            ]}
          />
        </div>

        <PanelState
          loading={emails.loading}
          error={emails.error}
          forbidden={emails.status === 403}
          empty={rows.length === 0 && filtered}
          emptyLabel={t("cms_emails:list.no_matches")}
          onRetry={emails.reload}
          ns="cms"
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={<EnvelopeSimple size={30}/>}
              title={t("cms_emails:list.empty_title")}
              description={t("cms_emails:list.empty_description")}
              action={
                <Button asChild variant="secondary">
                  <Link to={cmsRoute.emailNew}>
                    <PaperPlaneTilt size={16}/> {t("cms_emails:list.empty_cta")}
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                onRowClick={(row) => navigate(cmsRoute.emailItem(row.id))}
                caption={t("cms_emails:list.caption")}
              />
              <Pagination
                offset={offset}
                limit={PAGE_SIZE}
                count={rows.length}
                onChange={setOffset}
                disabled={emails.loading}
              />
            </>
          )}
        </PanelState>
      </Panel>
    </>
  );
};
