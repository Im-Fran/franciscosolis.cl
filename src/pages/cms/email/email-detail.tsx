import {useCallback} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {ArrowClockwise, PaperPlaneTilt} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {recipientsOf} from "@/pages/cms/email/email-shared.ts";

/** One row of the delivery facts; a fact the service did not send is not rendered at all. */
const Fact = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex flex-col gap-1 border-b border-neutral-800/70 py-3 last:border-0 sm:flex-row sm:gap-4">
    <dt className="text-[13px] text-neutral-500 sm:w-40 sm:shrink-0">{label}</dt>
    <dd className="min-w-0 text-[13px] break-words text-neutral-300">{children}</dd>
  </div>
);

/**
 * One logged message, exactly as the service recorded it.
 *
 * Nothing here can be changed — an attempt to deliver mail is history — so the screen answers the
 * two questions that bring anyone to it: what went out, and, when it failed, why.
 */
export const EmailDetail = () => {
  const {t, i18n} = useTranslation(["cms_emails", "cms"]);
  const {id = ""} = useParams();

  const message = useResource(
    useCallback((signal: AbortSignal) => cmsApi.emails.get(id, signal), [id]),
  );

  const data = message.data;
  const to = recipientsOf(data ?? {});
  const variables = Object.entries(data?.variables ?? {});
  const hasBody = Boolean(data?.html?.trim() || data?.text?.trim() || variables.length > 0);

  /* "Send again" is a shortcut into the compose form, not a resend: the API has no such endpoint,
     and pretending otherwise would hide the fact that a second message is being written. The record
     travels in the router state — a body does not fit in a query string — while `?template=` keeps
     the link meaningful on its own, which is all that survives a reload. */
  const composeTo = data?.template
    ? `${cmsRoute.emailNew}?template=${encodeURIComponent(data.template)}`
    : cmsRoute.emailNew;

  return (
    <>
      <PageHeader
        back={{to: cmsRoute.emails, label: t("cms_emails:detail.back")}}
        title={data?.subject || t("cms_emails:detail.untitled")}
        description={
          data && (
            <span className="flex flex-wrap items-center gap-3">
              <StatusBadge status={data.status}/>
              {data.created_at && (
                <span className="text-[13px] text-neutral-500">
                  {t("cms_emails:detail.created", {value: formatDateTime(data.created_at, i18n.language)})}
                </span>
              )}
            </span>
          )
        }
        actions={
          <>
            {/* Same reasoning as the log: `queued` becomes `sent` or `failed` server-side and this
                tab is never told, so the way to find out is a button rather than a poll. */}
            <Button variant="ghost" size="sm" onClick={message.reload} disabled={message.loading} data-fs-hover>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            <Button asChild variant="secondary" size="sm" data-fs-hover>
              <Link to={composeTo} state={{prefill: data}}>
                <PaperPlaneTilt size={14}/> {t("cms_emails:detail.send_again")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <Panel title={t("cms_emails:detail.delivery_title")} description={t("cms_emails:detail.delivery_description")}>
          <PanelState
            loading={message.loading}
            error={message.error}
            forbidden={message.status === 403}
            onRetry={message.reload}
            ns="cms"
          >
            {data && (
              <div className="flex flex-col gap-5">
                {data.status === "failed" && (
                  <Alert tone="error" title={t("cms_emails:detail.failed_title")}>
                    {data.error || t("cms_emails:detail.failed_unknown")}
                  </Alert>
                )}

                <dl className="flex flex-col">
                  <Fact label={t("cms_emails:detail.status")}>
                    <StatusBadge status={data.status}/>
                  </Fact>

                  <Fact label={t("cms_emails:detail.recipients")}>
                    {to.length > 0 ? (
                      <ul className="flex flex-col gap-1">
                        {to.map((address) => (
                          <li key={address}>{address}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-neutral-600">{t("cms_emails:detail.recipients_unknown")}</span>
                    )}
                  </Fact>

                  <Fact label={t("cms_emails:detail.template")}>
                    {data.template ? (
                      <Link
                        to={cmsRoute.templates}
                        className="text-accent-300 transition-colors hover:text-accent-200"
                        data-fs-hover
                      >
                        {data.template}
                      </Link>
                    ) : (
                      <span className="text-neutral-500">{t("cms_emails:detail.inline_body")}</span>
                    )}
                  </Fact>

                  {data.layout && <Fact label={t("cms_emails:detail.layout")}>{data.layout}</Fact>}
                  {data.heading && <Fact label={t("cms_emails:detail.heading")}>{data.heading}</Fact>}
                  {data.from && <Fact label={t("cms_emails:detail.from")}>{data.from}</Fact>}
                  {data.reply_to && <Fact label={t("cms_emails:detail.reply_to")}>{data.reply_to}</Fact>}
                  {data.created_at && (
                    <Fact label={t("cms_emails:detail.created_at")}>
                      {formatDateTime(data.created_at, i18n.language)}
                    </Fact>
                  )}
                  {data.sent_at && (
                    <Fact label={t("cms_emails:detail.sent_at")}>
                      {formatDateTime(data.sent_at, i18n.language)}
                    </Fact>
                  )}
                </dl>
              </div>
            )}
          </PanelState>
        </Panel>

        <Panel title={t("cms_emails:detail.body_title")} description={t("cms_emails:detail.body_description")}>
          <PanelState
            loading={message.loading}
            error={message.error}
            forbidden={message.status === 403}
            onRetry={message.reload}
            ns="cms"
          >
            {data && !hasBody && <p className="text-[13px] text-neutral-500">{t("cms_emails:detail.body_absent")}</p>}

            {data && hasBody && (
              <div className="flex flex-col gap-6">
                {variables.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-neutral-300">
                      {t("cms_emails:detail.variables")}
                    </h3>
                    <dl className="flex flex-col rounded-[var(--radius-md)] border border-neutral-800 px-4">
                      {variables.map(([name, value]) => (
                        <Fact key={name} label={name}>
                          {value || <span className="text-neutral-600">{t("admin:common.none")}</span>}
                        </Fact>
                      ))}
                    </dl>
                  </div>
                )}

                {data.html?.trim() && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-neutral-300">{t("cms_emails:detail.html")}</h3>
                    {/* The stored body is HTML that ran in someone else's mail client; it is shown
                        inside an iframe with `sandbox=""` — every capability withheld — rather than
                        injected into this page, where a script in it would run as the CMS. */}
                    <iframe
                      title={t("cms_emails:detail.html_preview_title")}
                      sandbox=""
                      srcDoc={data.html}
                      /* Mail is rendered on the client's own canvas, and that canvas is white. */
                      className="h-96 w-full rounded-[var(--radius-md)] border border-neutral-800 bg-white"
                    />
                  </div>
                )}

                {data.text?.trim() && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-neutral-300">{t("cms_emails:detail.text")}</h3>
                    <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-4 py-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-neutral-300">
                      {data.text}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </PanelState>
        </Panel>
      </div>
    </>
  );
};
