import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {ArrowClockwise, PaperPlaneTilt, Receipt} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";
import {formatAmount} from "@/lib/marketplace/money.ts";
import type {Voucher} from "@/lib/marketplace/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {ProductNav} from "@/pages/cms/marketplace/components/product-nav.tsx";
import {SourceBadge} from "@/pages/cms/marketplace/components/sale-badges.tsx";

/**
 * Every receipt this product ever issued, void ones included.
 *
 * The void ones are not noise and are not hidden: "you sent me this and you are now telling me it
 * is not valid" is exactly the conversation a voided receipt exists to settle, and a list that
 * dropped them would leave the recipient holding an email the system denies all knowledge of.
 *
 * Issuing and voiding happen on the sale, not here — a receipt only means anything as the receipt
 * *of* something, so this screen re-sends and links through. The one write it has is the re-send,
 * because "they never got it" is a request that arrives about a receipt rather than about a sale.
 */
export const VoucherList = () => {
  const {t, i18n} = useTranslation(["cms_marketplace", "cms", "admin"]);
  const {id = ""} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const locale = i18n.language;

  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");

  const filters = useMemo(() => ({status: status || undefined, email: email || undefined}), [status, email]);

  const product = useResource(
    useCallback((signal: AbortSignal) => marketplaceApi.products.get(id, signal), [id]),
  );
  const vouchers = useResource(
    useCallback((signal: AbortSignal) => marketplaceApi.vouchers.list(id, filters, signal), [id, filters]),
  );
  const send = useMutation(useCallback((voucherId: string) => marketplaceApi.vouchers.send(id, voucherId), [id]));

  const resend = async (voucher: Voucher) => {
    const outcome = await send.run(voucher.id);
    if (!outcome.ok) return;
    notify(t("cms_marketplace:vouchers.sent"));
    vouchers.reload();
  };

  const columns = useMemo<Column<Voucher>[]>(
    () => [
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
        key: "amount",
        header: t("cms_marketplace:vouchers.columns.amount"),
        className: "w-28",
        cell: (row) => (
          <span className="font-mono text-[13px] text-text">{formatAmount(row.amount, row.currency, locale)}</span>
        ),
      },
      {
        key: "source",
        header: t("cms_marketplace:vouchers.columns.source"),
        className: "w-36",
        hideBelowLg: true,
        cell: (row) => <SourceBadge source={row.source}/>,
      },
      {
        key: "status",
        header: t("cms_marketplace:vouchers.columns.status"),
        className: "w-28",
        cell: (row) => <StatusBadge status={row.status === "void" ? "revoked" : "sent"}/>,
      },
      {
        key: "issued_at",
        header: t("cms_marketplace:vouchers.columns.issued"),
        className: "w-40",
        hideBelowLg: true,
        cell: (row) => <span className="text-[13px] text-neutral-400">{formatDateTime(row.issued_at, locale)}</span>,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("cms_marketplace:vouchers.columns.actions")}</span>,
        className: "w-16 pr-0 text-right",
        cell: (row) => (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={row.status !== "issued" || send.pending}
            aria-label={t("cms_marketplace:vouchers.send_aria", {number: row.number})}
            onClick={(event) => {
              event.stopPropagation();
              void resend(row);
            }}
          >
            <PaperPlaneTilt size={16}/>
          </Button>
        ),
      },
    ],
    // `resend` closes over the mutation and the reload, both stable enough for a row action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, send.pending, t],
  );

  return (
    <>
      <PageHeader
        title={t("cms_marketplace:vouchers.title")}
        description={t("cms_marketplace:vouchers.description", {name: product.data?.name ?? ""})}
        back={{to: marketplaceRoute.list, label: t("cms_marketplace:editor.back")}}
      />

      <ProductNav id={id}/>

      <Panel
        title={t("cms_marketplace:vouchers.list_title")}
        description={vouchers.data ? t("cms_marketplace:vouchers.count", {count: vouchers.data.length}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={vouchers.reload}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Field label={t("cms_marketplace:vouchers.filters.status")} htmlFor="vouchers-status">
            <Select id="vouchers-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t("cms_marketplace:sales.filters.any")}</option>
              <option value="issued">{t("cms_marketplace:vouchers.statuses.issued")}</option>
              <option value="void">{t("cms_marketplace:vouchers.statuses.void")}</option>
            </Select>
          </Field>
          <Field label={t("cms_marketplace:vouchers.filters.email")} htmlFor="vouchers-email">
            <Input
              id="vouchers-email"
              type="search"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("cms_marketplace:sales.filters.email_placeholder")}
            />
          </Field>
        </div>

        {send.error && <p className="mb-3 text-[13px] text-red-400">{send.error}</p>}

        <PanelState
          loading={vouchers.loading}
          error={vouchers.error}
          forbidden={vouchers.status === 403}
          onRetry={vouchers.reload}
          ns="cms"
        >
          {(vouchers.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Receipt size={28}/>}
              title={t("cms_marketplace:vouchers.empty_title")}
              description={t("cms_marketplace:vouchers.list_empty_description")}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={vouchers.data ?? []}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(marketplaceRoute.saleItem(id, row.purchase_id))}
              caption={t("cms_marketplace:vouchers.caption")}
            />
          )}
        </PanelState>
      </Panel>
    </>
  );
};
