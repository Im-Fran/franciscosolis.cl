import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {ArrowClockwise, CurrencyDollar, Plus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";
import {formatAmount} from "@/lib/marketplace/money.ts";
import {PURCHASE_STATUSES, SALE_SOURCES} from "@/lib/marketplace/types.ts";
import type {Sale} from "@/lib/marketplace/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {ProductNav} from "@/pages/marketplace/components/product-nav.tsx";
import {EnvironmentBadge, SourceBadge} from "@/pages/marketplace/components/sale-badges.tsx";
import {RecordSaleDialog} from "@/pages/marketplace/components/record-sale-dialog.tsx";
import type {RecordSalePayload} from "@/pages/marketplace/components/record-sale-dialog.tsx";

/**
 * The takings of one product: what came in, how, and what went back out.
 *
 * The totals are read from the service rather than summed here, and that is not laziness — the
 * service computes them in the database over exactly the rows this listing selects, so the figure
 * at the top and the rows underneath can never disagree. Summing a page of fifty rows and calling
 * it revenue is the one bug in a screen like this that nobody forgives.
 *
 * Three figures are shown rather than one for the same reason: "how much did this make" has three
 * honest answers, and quoting the wrong one counts a refund as income.
 */
export const SalesList = () => {
  const {t, i18n} = useTranslation(["marketplace_admin", "cms", "admin"]);
  const {id = ""} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();

  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [email, setEmail] = useState("");
  const [recording, setRecording] = useState(false);

  /* The filters the listing and the summary both run under, so the two cannot drift apart. */
  const filters = useMemo(() => ({status: status || undefined, source: source || undefined, email: email || undefined}), [
    status,
    source,
    email,
  ]);

  const product = useResource(
    useCallback((signal: AbortSignal) => marketplaceApi.products.get(id, signal), [id]),
  );
  const sales = useResource(
    useCallback((signal: AbortSignal) => marketplaceApi.sales.list(id, filters, signal), [id, filters]),
  );
  const summary = useResource(
    useCallback((signal: AbortSignal) => marketplaceApi.sales.summary(id, filters, signal), [id, filters]),
  );

  const record = useMutation(
    useCallback((payload: RecordSalePayload) => marketplaceApi.sales.create(id, payload), [id]),
  );

  const locale = i18n.language;
  const currency = summary.data?.currency ?? "CLP";

  const columns = useMemo<Column<Sale>[]>(
    () => [
      {
        key: "created_at",
        header: t("marketplace_admin:sales.columns.date"),
        className: "w-32",
        cell: (row) => formatDate(row.created_at, locale) ?? <span className="text-neutral-600">—</span>,
      },
      {
        key: "email",
        header: t("marketplace_admin:sales.columns.buyer"),
        cell: (row) => (
          <span className="flex flex-col">
            <span className="text-sm text-text">{row.email}</span>
            {row.note && <span className="text-[12px] text-neutral-500">{row.note}</span>}
          </span>
        ),
      },
      {
        key: "amount",
        header: t("marketplace_admin:sales.columns.amount"),
        className: "w-32",
        cell: (row) => (
          <span className="flex flex-col">
            <span className="font-mono text-[13px] text-text">{formatAmount(row.amount, row.currency, locale)}</span>
            {/* Shown only when something went back, so a clean sale stays one line. */}
            {row.refunded_amount != null && (
              <span className="font-mono text-[12px] text-red-300">
                −{formatAmount(row.refunded_amount, row.currency, locale)}
              </span>
            )}
          </span>
        ),
      },
      {
        key: "source",
        header: t("marketplace_admin:sales.columns.source"),
        className: "w-40",
        cell: (row) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <SourceBadge source={row.source ?? "other"}/>
            <EnvironmentBadge environment={row.environment}/>
          </span>
        ),
      },
      {
        key: "status",
        header: t("marketplace_admin:sales.columns.status"),
        className: "w-32",
        cell: (row) => <StatusBadge status={row.status}/>,
      },
      {
        key: "withdrawal",
        header: t("marketplace_admin:sales.columns.withdrawal"),
        className: "w-36",
        hideBelowLg: true,
        /*
         * The statutory window, in words rather than as a date: an editor deciding whether to
         * refund needs "3 days left", and works a deadline out wrongly.
         */
        cell: (row) =>
          row.status !== "approved" || !row.withdrawal?.deadline ? (
            <span className="text-neutral-600">—</span>
          ) : row.withdrawal.within_period ? (
            <span className="text-[13px] text-amber-300">
              {t("marketplace_admin:sales.withdrawal_left", {count: row.withdrawal.days_left ?? 0})}
            </span>
          ) : (
            <span className="text-[13px] text-neutral-500">{t("marketplace_admin:sales.withdrawal_over")}</span>
          ),
      },
    ],
    [locale, t],
  );

  const submitSale = async (payload: RecordSalePayload) => {
    const outcome = await record.run(payload);
    /*
     * A 502 means the sale and its voucher were both written and only the email failed, so the
     * dialog stays open with that message while the lists still reload underneath — the sale is
     * real either way, and "Resend" lives on the sale itself.
     */
    if (!outcome.ok) {
      if (outcome.status === 502) {
        sales.reload();
        summary.reload();
      }
      return;
    }
    notify(t("marketplace_admin:sales.record.done"));
    setRecording(false);
    sales.reload();
    summary.reload();
  };

  const totals = summary.data;

  return (
    <>
      <PageHeader
        title={t("marketplace_admin:sales.title")}
        description={t("marketplace_admin:sales.description", {name: product.data?.name ?? ""})}
        back={{to: marketplaceRoute.list, label: t("marketplace_admin:editor.back")}}
        actions={
          <Button onClick={() => setRecording(true)}>
            <Plus size={16}/> {t("marketplace_admin:sales.record.open")}
          </Button>
        }
      />

      <ProductNav id={id}/>

      <Panel
        title={t("marketplace_admin:sales.totals.title")}
        description={t("marketplace_admin:sales.totals.description")}
        className="mb-6"
        action={
          totals?.environment === "sandbox" ? <EnvironmentBadge environment={totals.environment}/> : undefined
        }
      >
        <PanelState
          loading={summary.loading}
          error={summary.error}
          forbidden={summary.status === 403}
          onRetry={summary.reload}
          ns="cms"
        >
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {key: "net", value: formatAmount(totals?.net ?? 0, currency, locale), accent: true},
              {key: "gross", value: formatAmount(totals?.gross ?? 0, currency, locale)},
              {key: "returned", value: formatAmount(totals?.returned ?? 0, currency, locale)},
              {key: "active", value: String(totals?.active_count ?? 0)},
            ].map(({key, value, accent}) => (
              <div key={key} className="rounded-[var(--radius-md)] bg-neutral-900/60 px-4 py-3">
                <dt className="text-[12px] tracking-wide text-neutral-500 uppercase">
                  {t(`marketplace_admin:sales.totals.${key}`)}
                </dt>
                <dd className={accent ? "mt-1 font-display text-2xl text-accent-200" : "mt-1 font-display text-2xl text-text"}>
                  {value}
                </dd>
                <p className="mt-1 text-[12px] text-neutral-500">{t(`marketplace_admin:sales.totals.${key}_hint`)}</p>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13px] text-neutral-400">
            {t("marketplace_admin:sales.totals.buyers", {count: totals?.buyers ?? 0})}
          </p>
        </PanelState>
      </Panel>

      <Panel
        title={t("marketplace_admin:sales.panel_title")}
        description={sales.data ? t("marketplace_admin:sales.count", {count: sales.data.length}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={() => {
            sales.reload();
            summary.reload();
          }}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Field label={t("marketplace_admin:sales.filters.status")} htmlFor="sales-status">
            <Select id="sales-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t("marketplace_admin:sales.filters.any")}</option>
              {PURCHASE_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {t(`marketplace_admin:sales.statuses.${entry}`, {defaultValue: entry})}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("marketplace_admin:sales.filters.source")} htmlFor="sales-source">
            <Select id="sales-source" value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">{t("marketplace_admin:sales.filters.any")}</option>
              {SALE_SOURCES.map((entry) => (
                <option key={entry} value={entry}>
                  {t(`marketplace_admin:sales.sources.${entry}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("marketplace_admin:sales.filters.email")} htmlFor="sales-email">
            <Input
              id="sales-email"
              type="search"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("marketplace_admin:sales.filters.email_placeholder")}
            />
          </Field>
        </div>

        <PanelState
          loading={sales.loading}
          error={sales.error}
          forbidden={sales.status === 403}
          onRetry={sales.reload}
          ns="cms"
        >
          {(sales.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<CurrencyDollar size={28}/>}
              title={t("marketplace_admin:sales.empty_title")}
              description={t("marketplace_admin:sales.empty_description")}
              action={
                <Button onClick={() => setRecording(true)}>
                  <Plus size={16}/> {t("marketplace_admin:sales.record.open")}
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              rows={sales.data ?? []}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(marketplaceRoute.saleItem(id, row.id))}
              caption={t("marketplace_admin:sales.caption")}
            />
          )}
        </PanelState>
      </Panel>

      <RecordSaleDialog
        open={recording}
        onClose={() => setRecording(false)}
        onSubmit={(payload) => void submitSale(payload)}
        mutation={record}
      />
    </>
  );
};
