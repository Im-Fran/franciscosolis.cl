import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {useParams} from "react-router-dom";
import {ArrowClockwise, ArrowUUpLeft, PaperPlaneTilt, Prohibit, Receipt} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";
import {formatAmount} from "@/lib/marketplace/money.ts";
import {REFUND_REASONS} from "@/lib/marketplace/types.ts";
import type {RefundReason, Voucher} from "@/lib/marketplace/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {ProductNav} from "@/pages/cms/marketplace/components/product-nav.tsx";
import {EnvironmentBadge, SourceBadge} from "@/pages/cms/marketplace/components/sale-badges.tsx";

/**
 * One sale, and everything that can be done to it: correct its address, issue or re-send its
 * receipt, give the money back.
 *
 * What is deliberately absent is an editable amount, status or date. Those are what the sale *is*;
 * correcting one of them is a refund and a new sale rather than an edit, and the service refuses
 * them for that reason — a field here would be a field that silently disagreed with the API.
 *
 * Whether a refund is possible is read off the service too (`refund.refundable`, and `refund.reason`
 * for why not), so the button's state and the API's answer come from one place.
 */
export const SaleDetail = () => {
  const {t, i18n} = useTranslation(["cms_marketplace", "cms", "admin"]);
  const {id = "", saleId = ""} = useParams<{id: string; saleId: string}>();
  const {notify} = useToast();
  const locale = i18n.language;

  const [refunding, setRefunding] = useState(false);
  const [reason, setReason] = useState<RefundReason>("withdrawal");
  const [partial, setPartial] = useState("");
  const [notifyBuyer, setNotifyBuyer] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState<Voucher | null>(null);
  const [sendAddress, setSendAddress] = useState("");

  const detail = useResource(
    useCallback((signal: AbortSignal) => marketplaceApi.sales.get(id, saleId, signal), [id, saleId]),
  );

  const refund = useMutation(
    useCallback(
      (payload: {reason: RefundReason; amount?: number; notify?: boolean}) =>
        marketplaceApi.sales.refund(id, saleId, payload),
      [id, saleId],
    ),
  );
  const save = useMutation(
    useCallback(
      (payload: {email?: string; note?: string | null}) => marketplaceApi.sales.update(id, saleId, payload),
      [id, saleId],
    ),
  );
  const issue = useMutation(useCallback(() => marketplaceApi.vouchers.issue(id, saleId), [id, saleId]));
  const send = useMutation(
    useCallback(
      (voucherId: string, address?: string) => marketplaceApi.vouchers.send(id, voucherId, address ? {email: address} : {}),
      [id],
    ),
  );
  const voidVoucher = useMutation(
    useCallback((voucherId: string) => marketplaceApi.vouchers.void(id, voucherId), [id]),
  );

  const sale = detail.data?.sale;
  const refundable = detail.data?.refund.refundable ?? false;

  const facts = sale
    ? [
        {key: "status", value: <StatusBadge status={sale.status}/>},
        {key: "amount", value: formatAmount(sale.amount, sale.currency, locale)},
        {
          key: "source",
          value: (
            <span className="flex flex-wrap items-center gap-1.5">
              <SourceBadge source={sale.source ?? "other"}/>
              <EnvironmentBadge environment={sale.environment}/>
            </span>
          ),
        },
        {key: "kind", value: t(`cms_marketplace:sales.kinds.${sale.kind}`, {defaultValue: sale.kind})},
        {key: "reference", value: <span className="font-mono text-[12px]">{sale.reference ?? "—"}</span>},
        {key: "payment_id", value: <span className="font-mono text-[12px]">{sale.payment_id ?? "—"}</span>},
        {key: "created_at", value: formatDateTime(sale.created_at, locale) ?? "—"},
        {key: "approved_at", value: formatDateTime(sale.approved_at, locale) ?? "—"},
        {
          key: "withdrawal",
          value:
            sale.withdrawal?.deadline == null
              ? "—"
              : sale.withdrawal.within_period
                ? t("cms_marketplace:sales.withdrawal_left", {count: sale.withdrawal.days_left ?? 0})
                : t("cms_marketplace:sales.withdrawal_over"),
        },
        {
          key: "refund",
          value:
            sale.refunded_at == null
              ? "—"
              : `${formatAmount(sale.refunded_amount ?? sale.amount, sale.currency, locale)} · ${t(
                  `cms_marketplace:sales.reasons.${sale.refund_reason ?? "other"}`,
                  {defaultValue: sale.refund_reason ?? ""},
                )}`,
        },
        {key: "account", value: sale.linked_to_account ? sale.user_id : t("cms_marketplace:sales.unlinked")},
        {key: "recorded_by", value: sale.created_by ?? t("cms_marketplace:sales.recorded_by_provider")},
      ]
    : [];

  const vouchers = detail.data?.vouchers ?? [];

  const runVoid = async (voucher: Voucher) => {
    const outcome = await voidVoucher.run(voucher.id);
    if (!outcome.ok) return;
    notify(t("cms_marketplace:vouchers.voided"));
    detail.reload();
  };

  const runSend = async () => {
    if (!sendTo) return;
    const address = sendAddress.trim();
    const outcome = await send.run(sendTo.id, address && address !== sendTo.email ? address : undefined);
    if (!outcome.ok) return;
    notify(t("cms_marketplace:vouchers.sent"));
    setSendTo(null);
    detail.reload();
  };

  const voucherColumns: Column<Voucher>[] = [
    {
      key: "number",
      header: t("cms_marketplace:vouchers.columns.number"),
      className: "w-44",
      cell: (row) => <span className="font-mono text-[13px] text-accent-300">{row.number}</span>,
    },
    {
      key: "email",
      header: t("cms_marketplace:vouchers.columns.email"),
      cell: (row) => <span className="text-sm text-text">{row.email ?? "—"}</span>,
    },
    {
      key: "status",
      header: t("cms_marketplace:vouchers.columns.status"),
      className: "w-28",
      cell: (row) => <StatusBadge status={row.status === "void" ? "revoked" : "sent"}/>,
    },
    {
      key: "sent",
      header: t("cms_marketplace:vouchers.columns.sent"),
      className: "w-40",
      hideBelowLg: true,
      cell: (row) =>
        row.sent_count ? (
          <span className="text-[13px] text-neutral-400">
            {t("cms_marketplace:vouchers.sent_times", {count: row.sent_count})} ·{" "}
            {formatDateTime(row.last_sent_at, locale)}
          </span>
        ) : (
          <span className="text-[13px] text-amber-300">{t("cms_marketplace:vouchers.never_sent")}</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("cms_marketplace:vouchers.columns.actions")}</span>,
      className: "w-28 pr-0 text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={row.status !== "issued" || send.pending}
            aria-label={t("cms_marketplace:vouchers.send_aria", {number: row.number})}
            onClick={() => {
              setSendAddress(row.email ?? "");
              setSendTo(row);
            }}
          >
            <PaperPlaneTilt size={16}/>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-neutral-400 hover:text-red-300"
            disabled={row.status !== "issued" || voidVoucher.pending}
            aria-label={t("cms_marketplace:vouchers.void_aria", {number: row.number})}
            onClick={() => void runVoid(row)}
          >
            <Prohibit size={16}/>
          </Button>
        </div>
      ),
    },
  ];

  const runIssue = async () => {
    const outcome = await issue.run();
    if (!outcome.ok) return;
    notify(t("cms_marketplace:vouchers.issued"));
    detail.reload();
  };

  const runRefund = async () => {
    const amount = partial.trim() === "" ? undefined : Number.parseInt(partial, 10);
    const outcome = await refund.run({reason, amount, notify: notifyBuyer});
    if (!outcome.ok) return;
    notify(t("cms_marketplace:sales.refund.done"));
    setRefunding(false);
    setPartial("");
    detail.reload();
  };

  const runSave = async () => {
    const outcome = await save.run({
      ...(email !== null ? {email} : {}),
      ...(note !== null ? {note: note || null} : {}),
    });
    if (!outcome.ok) return;
    notify(t("admin:common.saved"));
    setEmail(null);
    setNote(null);
    detail.reload();
  };

  return (
    <>
      <PageHeader
        title={sale ? sale.email : t("cms_marketplace:sales.detail.title")}
        description={t("cms_marketplace:sales.detail.description")}
        back={{to: marketplaceRoute.sales(id), label: t("cms_marketplace:sales.detail.back")}}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={detail.reload}>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            <Button
              variant="secondary"
              disabled={!refundable}
              onClick={() => {
                refund.reset();
                setRefunding(true);
              }}
            >
              <ArrowUUpLeft size={16}/> {t("cms_marketplace:sales.refund.open")}
            </Button>
          </>
        }
      />

      <ProductNav id={id}/>

      <Panel title={t("cms_marketplace:sales.detail.panel_title")} className="mb-6">
        <PanelState
          loading={detail.loading}
          error={detail.error}
          forbidden={detail.status === 403}
          onRetry={detail.reload}
          ns="cms"
        >
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {facts.map(({key, value}) => (
              <div key={key} className="flex flex-col gap-0.5 border-b border-neutral-800/60 pb-2">
                <dt className="text-[12px] tracking-wide text-neutral-500 uppercase">
                  {t(`cms_marketplace:sales.detail.facts.${key}`)}
                </dt>
                <dd className="text-sm text-text">{value}</dd>
              </div>
            ))}
          </dl>

          {/*
            * Why a refund is unavailable, in words. The service answers `reason` for exactly this:
            * "the button is greyed out and nobody can say why" is the state to avoid.
            */}
          {!refundable && detail.data?.refund.reason && (
            <p className="mt-4 text-[13px] text-neutral-400">
              {t(`cms_marketplace:sales.refund.blocked_${detail.data.refund.reason}`)}
            </p>
          )}
        </PanelState>
      </Panel>

      <Panel
        title={t("cms_marketplace:sales.detail.edit_title")}
        description={t("cms_marketplace:sales.detail.edit_description")}
        className="mb-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("cms_marketplace:sales.detail.facts.email")}
            htmlFor="sale-edit-email"
            hint={t("cms_marketplace:sales.detail.email_hint")}
          >
            <Input
              id="sale-edit-email"
              type="email"
              value={email ?? sale?.email ?? ""}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field
            label={t("cms_marketplace:sales.detail.facts.note")}
            htmlFor="sale-edit-note"
            hint={t("cms_marketplace:sales.detail.note_hint")}
          >
            <Textarea
              id="sale-edit-note"
              rows={2}
              value={note ?? sale?.note ?? ""}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
        {save.error && <p className="mt-3 text-[13px] text-red-400">{save.error}</p>}
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void runSave()} disabled={save.pending || (email === null && note === null)}>
            {save.pending ? t("admin:common.saving") : t("admin:common.save")}
          </Button>
        </div>
      </Panel>

      <Panel
        title={t("cms_marketplace:vouchers.panel_title")}
        description={t("cms_marketplace:vouchers.panel_description")}
        action={
          <Button variant="secondary" size="sm" onClick={() => void runIssue()} disabled={issue.pending}>
            <Receipt size={14}/> {t("cms_marketplace:vouchers.issue")}
          </Button>
        }
      >
        {issue.error && (
          <p className="mb-3 text-[13px] text-red-400">
            {issue.status === 502 ? t("cms_marketplace:vouchers.issue_send_failed") : issue.error}
          </p>
        )}
        {send.error && <p className="mb-3 text-[13px] text-red-400">{send.error}</p>}
        {vouchers.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28}/>}
            title={t("cms_marketplace:vouchers.empty_title")}
            description={t("cms_marketplace:vouchers.empty_description")}
          />
        ) : (
          <DataTable
            columns={voucherColumns}
            rows={vouchers}
            rowKey={(row) => row.id}
            caption={t("cms_marketplace:vouchers.caption")}
          />
        )}
      </Panel>

      <Modal open={refunding} onClose={() => setRefunding(false)} title={t("cms_marketplace:sales.refund.title")}>
        <p className="mb-5 text-[13px] leading-relaxed text-neutral-400">{t("cms_marketplace:sales.refund.body")}</p>
        <div className="grid gap-4">
          <Field
            label={t("cms_marketplace:sales.refund.reason")}
            htmlFor="refund-reason"
            hint={t("cms_marketplace:sales.refund.reason_hint")}
          >
            <Select
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as RefundReason)}
            >
              {REFUND_REASONS.map((entry) => (
                <option key={entry} value={entry}>
                  {t(`cms_marketplace:sales.reasons.${entry}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("cms_marketplace:sales.refund.amount")}
            htmlFor="refund-amount"
            hint={t("cms_marketplace:sales.refund.amount_hint", {
              amount: sale ? formatAmount(sale.amount, sale.currency, locale) : "",
            })}
          >
            <Input
              id="refund-amount"
              type="number"
              min={1}
              max={sale?.amount}
              step={1}
              value={partial}
              onChange={(event) => setPartial(event.target.value)}
              placeholder={sale ? String(sale.amount) : ""}
            />
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-neutral-300">
            <input
              type="checkbox"
              checked={notifyBuyer}
              onChange={(event) => setNotifyBuyer(event.target.checked)}
              className="size-4 accent-accent-500"
            />
            {t("cms_marketplace:sales.refund.notify")}
          </label>
        </div>
        {refund.error && <p className="mt-4 text-[13px] text-red-400">{refund.error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setRefunding(false)}>
            {t("admin:common.cancel")}
          </Button>
          <Button onClick={() => void runRefund()} disabled={refund.pending}>
            {refund.pending ? t("cms_marketplace:sales.refund.pending") : t("cms_marketplace:sales.refund.submit")}
          </Button>
        </div>
      </Modal>

      <Modal open={sendTo !== null} onClose={() => setSendTo(null)} title={t("cms_marketplace:vouchers.send_title")}>
        <p className="mb-5 text-[13px] leading-relaxed text-neutral-400">{t("cms_marketplace:vouchers.send_body")}</p>
        <Field
          label={t("cms_marketplace:vouchers.send_to")}
          htmlFor="voucher-send-to"
          hint={t("cms_marketplace:vouchers.send_to_hint")}
        >
          <Input
            id="voucher-send-to"
            type="email"
            value={sendAddress}
            onChange={(event) => setSendAddress(event.target.value)}
          />
        </Field>
        {send.error && <p className="mt-4 text-[13px] text-red-400">{send.error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setSendTo(null)}>
            {t("admin:common.cancel")}
          </Button>
          <Button onClick={() => void runSend()} disabled={send.pending}>
            {send.pending ? t("cms_marketplace:vouchers.sending") : t("cms_marketplace:vouchers.send")}
          </Button>
        </div>
      </Modal>
    </>
  );
};
