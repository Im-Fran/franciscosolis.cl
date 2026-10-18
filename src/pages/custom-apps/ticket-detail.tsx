import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {FloppyDisk, PaperPlaneTilt, PencilSimple} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatLastSeen, formatMinutes} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import {REPLY_STATUSES, TICKET_LIMITS} from "@/lib/custom-apps/types.ts";
import type {ReplyStatus, Ticket, TicketDetail as TicketRecord, TicketMessage, TicketStatus} from "@/lib/custom-apps/types.ts";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {TicketStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";
import {WorkLogPanel} from "@/pages/custom-apps/components/work-log/work-log-panel.tsx";
import type {WorkLogScope} from "@/pages/custom-apps/components/work-log/work-log-scope.ts";
import {cn} from "@/lib/utils.ts";

const REFRESH_MS = 30_000;

/** One message of the conversation: the requester on the left, support on the right. */
const MessageBubble = ({message}: {message: TicketMessage}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const language = i18n.language;
  const staff = message.author === "staff";
  const author = message.author_name || (staff ? t("tickets.from_staff") : t("tickets.from_requester"));

  return (
    <li className={cn("flex", staff ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-[var(--radius-lg)] border px-4 py-3",
          staff ? "border-accent-800/60 bg-accent-900/30" : "border-neutral-800 bg-neutral-800/40",
        )}
      >
        <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-neutral-500">
          <span className={staff ? "text-accent-200" : "text-neutral-300"}>{author}</span>
          <span>{staff ? t("tickets.from_staff") : t("tickets.from_requester")}</span>
          <time dateTime={message.created_at} title={formatLastSeen(message.created_at, language) ?? undefined}>
            {formatDateTime(message.created_at, language)}
          </time>
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed break-words whitespace-pre-line text-neutral-200">{message.body}</p>
        {/* For an answer, whether the app has fetched it yet: the requester's side of "read". */}
        {staff && (
          <p className="mt-1.5 text-right text-[11px] text-neutral-500">
            {message.seen_at ? t("tickets.seen", {date: formatDateTime(message.seen_at, language)}) : t("tickets.not_seen")}
          </p>
        )}
      </div>
    </li>
  );
};

/**
 * One support ticket — where the notification centre's links land, at `/custom-apps/tickets/:id`.
 *
 * Opening it marks the requester's messages read on the service, so the inbox's unread count drops
 * the moment somebody looks. An answer is read back by the app that opened the ticket on its next
 * request; nothing here sends mail. Answering leaves the ticket `pending` (waiting on the requester)
 * unless the reply says `resolved` or `closed`, and the status selector changes it without writing
 * to anybody — reopening a ticket is that selector too.
 *
 * The device's context is the snapshot taken when the ticket was opened, not the device now: the
 * installation link is there for the present. The work logged against the ticket is the ordinary
 * work log, narrowed to it, so time is logged, corrected and filed against a contract exactly as
 * anywhere else.
 */
export const TicketDetail = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {ticketId = ""} = useParams<{ticketId: string}>();
  const {notify} = useToast();
  const {ticketStatuses} = useServiceVocabulary();
  const language = i18n.language;

  const record = useResource(useCallback((signal: AbortSignal) => customAppsApi.tickets.get(ticketId, signal), [ticketId]));
  useAutoRefresh(record.reload, REFRESH_MS);
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  useEffect(() => {
    if (record.data) setTicket(record.data);
  }, [record.data]);

  const [reply, setReply] = useState("");
  const [after, setAfter] = useState<ReplyStatus>("pending");
  const [editingSubject, setEditingSubject] = useState(false);
  const [subject, setSubject] = useState("");

  const send = useMutation(
    useCallback((body: {message: string; status: ReplyStatus}) => customAppsApi.tickets.reply(ticketId, body), [ticketId]),
  );
  const update = useMutation(
    useCallback((body: {status?: TicketStatus; subject?: string}) => customAppsApi.tickets.update(ticketId, body), [ticketId]),
  );

  /* A write answers with the ticket but not its work log; keep what this page already has. */
  const merge = useCallback(
    (next: Ticket) =>
      setTicket((current) =>
        current
          ? {...current, ...next, messages: next.messages ?? current.messages, work_logs: current.work_logs}
          : current,
      ),
    [],
  );

  const current = ticket && ticket.id === ticketId ? ticket : null;
  const scopeAppId = current?.app_id ?? "";
  const scopeCompanyId = current?.company_id ?? "";
  const scope = useMemo<WorkLogScope | null>(
    () => (scopeAppId ? {kind: "app", appId: scopeAppId, companyId: scopeCompanyId} : null),
    [scopeAppId, scopeCompanyId],
  );
  const back = {to: customAppsRoute.tickets(), label: t("custom_apps:tickets.back")};

  if (!current || !scope) {
    return (
      <>
        <PageHeader title={t("custom_apps:tickets.loading_title")} back={back} />
        <Panel title={t("custom_apps:tickets.conversation")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const changeStatus = async (status: TicketStatus) => {
    if (status === current.status) return;
    const outcome = await update.run({status});
    if (!outcome.ok) {
      notify(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}), "error");
      return;
    }
    merge(outcome.data);
    notify(t("custom_apps:tickets.status_changed"));
  };

  const saveSubject = async (event: FormEvent) => {
    event.preventDefault();
    const value = subject.trim();
    if (!value || value === current.subject) {
      setEditingSubject(false);
      return;
    }
    const outcome = await update.run({subject: value});
    if (!outcome.ok) return;
    merge(outcome.data);
    setEditingSubject(false);
    notify(t("custom_apps:tickets.subject_saved"));
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    const message = reply.trim();
    if (!message) return;
    const outcome = await send.run({message, status: after});
    if (!outcome.ok) return;
    merge(outcome.data);
    setReply("");
    setAfter("pending");
    notify(t("custom_apps:tickets.sent"));
  };

  const context = current.context;
  const device = context?.installation;
  const logs = context?.logs ?? [];
  const crashes = context?.crashes ?? [];
  const requester = [current.requester_name, current.requester_email].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title={`#${current.number} · ${current.subject}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge value={current.status} />
            <Link to={customAppsRoute.app(current.app_id)} className="hover:text-text hover:underline">
              {current.app_name ?? current.app_id}
            </Link>
            <span aria-hidden="true">·</span>
            <Link to={customAppsRoute.company(current.company_id)} className="hover:text-text hover:underline">
              {current.company_name ?? current.company_id}
            </Link>
            {requester && (
              <>
                <span aria-hidden="true">·</span>
                <span>{requester}</span>
              </>
            )}
          </span>
        }
        back={back}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                update.reset();
                setSubject(current.subject);
                setEditingSubject(true);
              }}
            >
              <PencilSimple size={14} /> {t("custom_apps:tickets.edit_subject")}
            </Button>
            <Select
              value={current.status}
              onChange={(event) => void changeStatus(event.target.value as TicketStatus)}
              disabled={update.pending}
              aria-label={t("custom_apps:tickets.status")}
              className="h-9 w-auto min-w-[12rem] text-[13px]"
            >
              {ticketStatuses.map((value) => (
                <option key={value} value={value} title={t(`custom_apps:ticket_statuses_hint.${value}`, {defaultValue: ""}) || undefined}>
                  {t(`custom_apps:ticket_statuses.${value}`, {defaultValue: value})}
                </option>
              ))}
            </Select>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6 xl:col-span-2">
            <Panel title={t("custom_apps:tickets.conversation")} description={t("custom_apps:tickets.conversation_description")}>
              {(current.messages ?? []).length === 0 ? (
                <p className="py-2 text-sm text-neutral-500">{t("custom_apps:tickets.no_messages")}</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {(current.messages ?? []).map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </ol>
              )}

              <form onSubmit={submitReply} className="mt-6 flex flex-col gap-4 border-t border-neutral-800 pt-5" noValidate>
                {current.status === "closed" && (
                  <Alert tone="info" title={t("custom_apps:ticket_statuses.closed")}>
                    {t("custom_apps:tickets.closed_notice")}
                  </Alert>
                )}
                <Field label={t("custom_apps:tickets.reply")} htmlFor="ticket-reply" hint={t("custom_apps:tickets.reply_hint")}>
                  <Textarea
                    id="ticket-reply"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={5}
                    maxLength={TICKET_LIMITS.maxMessageLength}
                    disabled={send.pending}
                    className="resize-y"
                  />
                </Field>
                {send.error && (
                  <Alert tone="error" title={t("admin:common.failed")}>
                    {t(`admin:errors.${send.error}`, {defaultValue: send.error})}
                  </Alert>
                )}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <Field label={t("custom_apps:tickets.status_after")} htmlFor="ticket-reply-status">
                    <Select
                      id="ticket-reply-status"
                      value={after}
                      onChange={(event) => setAfter(event.target.value as ReplyStatus)}
                      disabled={send.pending}
                      className="h-9 w-auto min-w-[14rem] text-[13px]"
                    >
                      {REPLY_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {t(`custom_apps:ticket_statuses.${value}`, {defaultValue: value})}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" disabled={send.pending || !reply.trim()}>
                    {send.pending ? <Spinner size={16} /> : <PaperPlaneTilt size={16} />}
                    {t("custom_apps:tickets.send")}
                  </Button>
                </div>
              </form>
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel title={t("custom_apps:tickets.details")}>
              <DetailList className="sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-1">
                <Detail label={t("custom_apps:tickets.requester")}>{current.requester_name ?? t("custom_apps:tickets.anonymous")}</Detail>
                <Detail label={t("custom_apps:tickets.email")}>
                  {current.requester_email && (
                    <a href={`mailto:${current.requester_email}`} className="break-all hover:underline">
                      {current.requester_email}
                    </a>
                  )}
                </Detail>
                <Detail label={t("custom_apps:tickets.app")}>
                  <Link to={customAppsRoute.app(current.app_id)} className="hover:underline">
                    {current.app_name ?? current.app_id}
                  </Link>
                </Detail>
                <Detail label={t("custom_apps:tickets.company")}>
                  <Link to={customAppsRoute.company(current.company_id)} className="hover:underline">
                    {current.company_name ?? current.company_id}
                  </Link>
                </Detail>
                <Detail label={t("custom_apps:tickets.installation")}>
                  {current.installation_id ? (
                    <Link to={customAppsRoute.installation(current.installation_id)} className="hover:underline">
                      {current.installation_name ?? device?.name ?? current.installation_id}
                    </Link>
                  ) : (
                    <span className="text-neutral-500 italic">{t("custom_apps:tickets.installation_gone")}</span>
                  )}
                </Detail>
                <Detail label={t("custom_apps:tickets.opened")}>{formatDateTime(current.created_at, language)}</Detail>
                <Detail label={t("custom_apps:tickets.last_activity")}>
                  {current.last_message_at && formatLastSeen(current.last_message_at, language)}
                </Detail>
                <Detail label={t("custom_apps:tickets.resolved_at")}>
                  {current.resolved_at &&
                    `${formatDateTime(current.resolved_at, language)}${current.resolved_by ? ` · ${current.resolved_by}` : ""}`}
                </Detail>
                <Detail label={t("custom_apps:tickets.logged")}>
                  {current.logged_minutes > 0 ? formatMinutes(current.logged_minutes) : null}
                </Detail>
              </DetailList>
            </Panel>

            <Panel title={t("custom_apps:tickets.context")} description={t("custom_apps:tickets.context_description")}>
              {!device && logs.length === 0 && crashes.length === 0 ? (
                <p className="text-sm text-neutral-500">{t("custom_apps:tickets.no_context")}</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {device && (
                    <DetailList className="sm:grid-cols-2 lg:grid-cols-2">
                      <Detail label={t("custom_apps:tickets.context_fields.name")}>{device.name}</Detail>
                      <Detail label={t("custom_apps:tickets.context_fields.app_version")} mono>
                        {device.app_version}
                      </Detail>
                      <Detail label={t("custom_apps:tickets.context_fields.channel")}>
                        {device.channel && t(`custom_apps:channels.${device.channel}`, {defaultValue: device.channel})}
                      </Detail>
                      <Detail label={t("custom_apps:tickets.context_fields.platform")}>
                        {device.platform && t(`custom_apps:platforms.${device.platform}`, {defaultValue: device.platform})}
                      </Detail>
                      <Detail label={t("custom_apps:tickets.context_fields.os")}>{device.os}</Detail>
                      <Detail label={t("custom_apps:tickets.context_fields.arch")} mono>
                        {device.arch}
                      </Detail>
                      <Detail label={t("custom_apps:tickets.context_fields.last_seen")}>
                        {device.last_seen_at && formatDateTime(device.last_seen_at, language)}
                      </Detail>
                      <Detail label={t("custom_apps:tickets.context_fields.device_id")} mono>
                        {device.device_id}
                      </Detail>
                    </DetailList>
                  )}

                  {logs.length === 0 && crashes.length === 0 ? (
                    <p className="text-[13px] text-neutral-500">{t("custom_apps:tickets.no_diagnostics")}</p>
                  ) : (
                    <>
                      {crashes.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:tickets.crashes")}</p>
                          <ul className="flex flex-col gap-1 text-[13px] text-neutral-300">
                            {crashes.map((crash, index) => (
                              <li key={`${index}-${crash}`} className="break-words">
                                {crash}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {logs.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:tickets.logs")}</p>
                          <pre className="max-h-72 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all text-neutral-300">
                            {logs.join("\n")}
                          </pre>
                        </div>
                      )}
                      {/* The snapshot names crash groups by title only; the app's diagnostics list has them all. */}
                      <Link to={customAppsRoute.appDiagnostics(current.app_id)} className="text-[13px] text-neutral-400 hover:text-text hover:underline">
                        {t("custom_apps:tickets.open_diagnostics")}
                      </Link>
                    </>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </div>

        <WorkLogPanel
          scope={scope}
          ticket={{id: current.id, number: current.number}}
          onChanged={record.reload}
          title={t("custom_apps:tickets.work_log_title")}
          description={t("custom_apps:tickets.work_log_description")}
        />
      </div>

      <Modal
        open={editingSubject}
        onClose={update.pending ? () => undefined : () => setEditingSubject(false)}
        title={t("custom_apps:tickets.edit_subject")}
        className="max-w-md"
      >
        <form onSubmit={saveSubject} className="flex flex-col gap-5" noValidate>
          <Field label={t("custom_apps:tickets.subject")} htmlFor="ticket-subject">
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={TICKET_LIMITS.maxSubjectLength}
              autoComplete="off"
              required
            />
          </Field>
          {update.error && editingSubject && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${update.error}`, {defaultValue: update.error})}
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditingSubject(false)} disabled={update.pending}>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={update.pending || !subject.trim()}>
              {update.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
              {t("admin:common.save")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
