import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent, ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";
import {FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {FieldLegend, FormHelpButton, RequiredLegend} from "@/components/ui/help.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {dayIn} from "@/lib/custom-apps/format.ts";
import type {
  BillingPeriod,
  ContractDetail,
  ContractPayload,
  Currency,
  CyclePeriod,
  GraceAllowance,
  NewContract,
} from "@/lib/custom-apps/types.ts";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {CompanySelect} from "@/pages/custom-apps/components/app-form-fields.tsx";
import {CheckboxField} from "@/pages/custom-apps/components/checkbox-field.tsx";
import {CheckboxGroup} from "@/pages/custom-apps/components/checkbox-group.tsx";
import {hoursToMinutes, minutesToHours} from "@/pages/custom-apps/components/contracts/contract-format.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const NAME_MAX = 160;
const GRACE_MESSAGE_MAX = 1000;
const NOTES_MAX = 5000;
const MONEY_MAX = 1_000_000_000;
const MINUTES_MAX = 1_000_000;
const RENEWAL_MONTHS = {min: 1, max: 120} as const;
const ROLLOVER_CYCLES_MAX = 120;

type Form = {
  name: string;
  companyId: string;
  amount: string;
  currency: Currency;
  billingPeriod: BillingPeriod;
  startsOn: string;
  endsOn: string;
  autoRenew: boolean;
  renewalMonths: string;
  noticeDays: string;
  cyclePeriod: CyclePeriod;
  includedHours: string;
  overageRate: string;
  rolloverEnabled: boolean;
  rolloverMaxHours: string;
  rolloverMaxCycles: string;
  graceDays: string;
  graceAllows: GraceAllowance[];
  graceMessage: string;
  notes: string;
  appIds: string[];
};

type FieldName = keyof Form;

const emptyForm = (companyId: string, today: string, noticeDays: number): Form => ({
  name: "",
  companyId,
  amount: "0",
  currency: "CLP",
  billingPeriod: "monthly",
  startsOn: today,
  endsOn: "",
  autoRenew: false,
  renewalMonths: "12",
  noticeDays: String(noticeDays),
  cyclePeriod: "monthly",
  includedHours: "0",
  overageRate: "0",
  rolloverEnabled: false,
  rolloverMaxHours: "",
  rolloverMaxCycles: "",
  graceDays: "0",
  graceAllows: [],
  graceMessage: "",
  notes: "",
  appIds: [],
});

const toForm = (source: ContractDetail): Form => ({
  name: source.name,
  companyId: source.company_id,
  amount: String(source.amount),
  currency: source.currency,
  billingPeriod: source.billing_period,
  startsOn: source.starts_on,
  endsOn: source.ends_on ?? "",
  autoRenew: source.auto_renew,
  renewalMonths: String(source.renewal_months),
  noticeDays: String(source.notice_days),
  cyclePeriod: source.cycle_period,
  includedHours: minutesToHours(source.included_minutes),
  overageRate: String(source.overage_rate),
  rolloverEnabled: source.rollover_enabled,
  rolloverMaxHours: minutesToHours(source.rollover_max_minutes),
  rolloverMaxCycles: source.rollover_max_cycles === null ? "" : String(source.rollover_max_cycles),
  graceDays: String(source.grace_days),
  graceAllows: [...source.grace_allows].sort(),
  graceMessage: source.grace_message ?? "",
  notes: source.notes ?? "",
  appIds: source.apps.map((app) => app.id).sort(),
});

/** A number in a currency: CLP is whole pesos, UF carries at most two decimals. */
const parseMoney = (value: string, currency: Currency) => {
  const normalised = value.trim().replace(",", ".");
  if (!normalised) return Number.NaN;
  const amount = Number(normalised);
  if (!Number.isFinite(amount) || amount < 0 || amount > MONEY_MAX) return Number.NaN;
  const decimals = normalised.includes(".") ? normalised.split(".")[1].length : 0;
  if (decimals > (currency === "CLP" ? 0 : 2)) return Number.NaN;
  return amount;
};

const parseInteger = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
};

const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const Section = ({title, description, children}: {title: string; description?: string; children: ReactNode}) => (
  <Panel title={title} description={description}>
    <div className="grid gap-5 sm:grid-cols-2">{children}</div>
  </Panel>
);

/**
 * Creating a contract, or changing one: the plan and its price, its dates and how it renews, the
 * hours each cycle includes and what happens to the unused ones, what the apps may still do once it
 * lapses, and which of the client's apps it covers.
 *
 * Hours are typed as hours and go on the wire as whole minutes. Once a contract has a cycle, its
 * start day and its cycle length are fixed — the cycles are anchored on them — so both fields are
 * disabled, and the service's 409 is explained if it is reached anyway.
 */
export const ContractEditor = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {contractId} = useParams<{contractId: string}>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {notify} = useToast();
  const vocabulary = useServiceVocabulary();
  const {contractLimits, timezone} = vocabulary;
  const help = useHelp();
  const today = dayIn(new Date(), timezone);

  const initial = useMemo(
    () => emptyForm(params.get("company_id") ?? "", today, contractLimits.default_notice_days),
    // Only the first render's prefill: a later change of the address is not a reset of the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [form, setForm] = useState<Form>(initial);
  const [baseline, setBaseline] = useState<Form>(initial);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});

  const record = useResource(
    useCallback(
      (signal: AbortSignal) => (contractId ? customAppsApi.contracts.get(contractId, signal) : Promise.resolve(null)),
      [contractId],
    ),
  );
  /* Whether a cycle exists, which fixes the start day and the cycle length. One row is enough. */
  const cycleProbe = useResource(
    useCallback(
      (signal: AbortSignal) => (contractId ? customAppsApi.contracts.cycles(contractId, {limit: 1}, signal) : Promise.resolve(null)),
      [contractId],
    ),
  );

  const loaded = record.data;
  useEffect(() => {
    if (!loaded) return;
    const next = toForm(loaded);
    setForm(next);
    setBaseline(next);
  }, [loaded]);

  const companyApps = useResource(
    useCallback(
      (signal: AbortSignal) =>
        form.companyId ? customAppsApi.apps.list({company_id: form.companyId, limit: 200}, signal) : Promise.resolve(null),
      [form.companyId],
    ),
  );

  const hasCycles = Boolean(loaded?.current_cycle) || (cycleProbe.data?.pagination.total ?? 0) > 0;
  const cancelled = loaded?.status === "cancelled";

  const save = useMutation(
    useCallback(
      (payload: ContractPayload) =>
        contractId ? customAppsApi.contracts.update(contractId, payload) : customAppsApi.contracts.create(payload as NewContract),
      [contractId],
    ),
  );

  const dirty = useMemo(
    () =>
      (Object.keys(form) as FieldName[]).some((key) => {
        const a = form[key];
        const b = baseline[key];
        return Array.isArray(a) && Array.isArray(b) ? !same(a, b) : a !== b;
      }),
    [form, baseline],
  );

  const set = <K extends FieldName>(key: K, value: Form[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
  };

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    const required = t("custom_apps:validation.required");
    const name = form.name.trim();
    if (!name) found.name = required;
    else if (name.length > NAME_MAX) found.name = t("custom_apps:validation.too_long", {max: NAME_MAX});
    if (!contractId && !form.companyId) found.companyId = required;

    const moneyHint = t(form.currency === "CLP" ? "custom_apps:contract_editor.errors.money_clp" : "custom_apps:contract_editor.errors.money_uf");
    if (!Number.isFinite(parseMoney(form.amount, form.currency))) found.amount = moneyHint;
    if (!Number.isFinite(parseMoney(form.overageRate, form.currency))) found.overageRate = moneyHint;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startsOn)) found.startsOn = required;
    if (form.endsOn && form.endsOn < form.startsOn) found.endsOn = t("custom_apps:contract_editor.errors.ends_before");

    const renewal = parseInteger(form.renewalMonths);
    if (form.autoRenew && !(renewal >= RENEWAL_MONTHS.min && renewal <= RENEWAL_MONTHS.max)) {
      found.renewalMonths = t("custom_apps:rules.range", RENEWAL_MONTHS);
    }
    const notice = parseInteger(form.noticeDays);
    if (!(notice >= 0 && notice <= contractLimits.max_notice_days)) {
      found.noticeDays = t("custom_apps:rules.range", {min: 0, max: contractLimits.max_notice_days});
    }

    const included = hoursToMinutes(form.includedHours);
    if (included === null || !Number.isFinite(included) || included > MINUTES_MAX) found.includedHours = t("custom_apps:contract_editor.errors.hours");
    if (form.rolloverEnabled) {
      const cap = hoursToMinutes(form.rolloverMaxHours);
      if (cap !== null && (!Number.isFinite(cap) || cap > MINUTES_MAX)) found.rolloverMaxHours = t("custom_apps:contract_editor.errors.hours");
      if (form.rolloverMaxCycles.trim()) {
        const cycles = parseInteger(form.rolloverMaxCycles);
        if (!(cycles >= 1 && cycles <= ROLLOVER_CYCLES_MAX)) found.rolloverMaxCycles = t("custom_apps:rules.range", {min: 1, max: ROLLOVER_CYCLES_MAX});
      }
    }

    const grace = parseInteger(form.graceDays);
    if (!(grace >= 0 && grace <= contractLimits.max_grace_days)) {
      found.graceDays = t("custom_apps:rules.range", {min: 0, max: contractLimits.max_grace_days});
    }
    if (form.graceMessage.trim().length > GRACE_MESSAGE_MAX) found.graceMessage = t("custom_apps:validation.too_long", {max: GRACE_MESSAGE_MAX});
    if (form.notes.trim().length > NOTES_MAX) found.notes = t("custom_apps:validation.too_long", {max: NOTES_MAX});
    return found;
  };

  const fullPayload = (): NewContract => ({
    company_id: form.companyId,
    name: form.name.trim(),
    amount: parseMoney(form.amount, form.currency),
    currency: form.currency,
    billing_period: form.billingPeriod,
    starts_on: form.startsOn,
    ends_on: form.endsOn || null,
    auto_renew: form.autoRenew,
    renewal_months: form.autoRenew ? parseInteger(form.renewalMonths) : Number(baseline.renewalMonths) || 12,
    notice_days: parseInteger(form.noticeDays),
    cycle_period: form.cyclePeriod,
    included_minutes: hoursToMinutes(form.includedHours) ?? 0,
    rollover_enabled: form.rolloverEnabled,
    rollover_max_minutes: form.rolloverEnabled ? hoursToMinutes(form.rolloverMaxHours) : null,
    rollover_max_cycles: form.rolloverEnabled && form.rolloverMaxCycles.trim() ? parseInteger(form.rolloverMaxCycles) : null,
    overage_rate: parseMoney(form.overageRate, form.currency),
    grace_days: parseInteger(form.graceDays),
    grace_allows: form.graceAllows,
    grace_message: orNull(form.graceMessage),
    notes: orNull(form.notes),
    app_ids: form.appIds,
  });

  /** Only what changed goes on a PATCH: an untouched start day must not trip the "cycles exist" 409. */
  const payloadOf = (): ContractPayload => {
    const full = fullPayload();
    if (!contractId || !loaded) return full;
    const changed: ContractPayload = {};
    const original = toForm(loaded);
    const keyed: Array<[FieldName, keyof ContractPayload]> = [
      ["name", "name"],
      ["billingPeriod", "billing_period"],
      ["startsOn", "starts_on"],
      ["endsOn", "ends_on"],
      ["autoRenew", "auto_renew"],
      ["noticeDays", "notice_days"],
      ["cyclePeriod", "cycle_period"],
      ["includedHours", "included_minutes"],
      ["rolloverEnabled", "rollover_enabled"],
      ["rolloverMaxHours", "rollover_max_minutes"],
      ["rolloverMaxCycles", "rollover_max_cycles"],
      ["graceDays", "grace_days"],
      ["graceMessage", "grace_message"],
      ["notes", "notes"],
    ];
    const assign = <K extends keyof ContractPayload>(key: K) => {
      changed[key] = full[key];
    };
    for (const [field, key] of keyed) if (form[field] !== original[field]) assign(key);
    if (form.autoRenew && form.renewalMonths !== original.renewalMonths) assign("renewal_months");
    /* A change of currency re-reads both amounts in the new one. */
    if (form.amount !== original.amount || form.currency !== original.currency) assign("amount");
    if (form.overageRate !== original.overageRate || form.currency !== original.currency) assign("overage_rate");
    if (form.currency !== original.currency) assign("currency");
    if (!same(form.graceAllows, original.graceAllows)) assign("grace_allows");
    if (!same(form.appIds, original.appIds)) assign("app_ids");
    if (!form.rolloverEnabled && original.rolloverEnabled) {
      changed.rollover_max_minutes = null;
      changed.rollover_max_cycles = null;
    }
    return changed;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = payloadOf();
    if (contractId && Object.keys(payload).length === 0) {
      navigate(customAppsRoute.contract(contractId));
      return;
    }
    const outcome = await save.run(payload);
    if (!outcome.ok) return;
    setBaseline(form);
    notify(contractId ? t("admin:common.saved") : t("admin:common.created"));
    navigate(customAppsRoute.contract(outcome.data.id), {replace: !contractId});
  };

  const failure = (() => {
    if (!save.error) return null;
    if (save.status === 409 && /starts_on and cycle_period/i.test(save.error)) return t("custom_apps:contract_editor.errors.anchored");
    if (save.status === 409 && /already covered/i.test(save.error)) return t("custom_apps:contract_editor.errors.app_clash", {detail: save.error});
    if (save.status === 409 && /cancelled/i.test(save.error)) return t("custom_apps:contract_editor.errors.cancelled");
    if (save.status === 409 && /cycle already starts after/i.test(save.error)) return t("custom_apps:contract_editor.errors.ends_before_cycle");
    if (save.status === 422) return t("custom_apps:contract_editor.errors.foreign_app");
    return t(`admin:errors.${save.error}`, {defaultValue: save.error});
  })();

  const back = contractId
    ? {to: customAppsRoute.contract(contractId), label: t("custom_apps:contract.back_to_contract")}
    : {to: customAppsRoute.contracts, label: t("custom_apps:contracts.back")};
  const formId = "contract-form";

  const header = (
    <PageHeader
      title={contractId ? t("custom_apps:contract_editor.edit_title", {name: loaded?.name ?? ""}) : t("custom_apps:contract_editor.new_title")}
      description={t("custom_apps:contract_editor.description")}
      back={back}
      actions={
        <>
          <FormHelpButton help={help.form("contract_editor.form_help")} />
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          <Button type="submit" form={formId} disabled={save.pending || cancelled}>
            {save.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
            {contractId ? t("admin:common.save") : t("admin:common.create")}
          </Button>
        </>
      }
    />
  );

  if (contractId && !loaded) {
    return (
      <>
        {header}
        <Panel title={t("custom_apps:contract_editor.scope")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const appRows = [...(companyApps.data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const decimals = form.currency === "CLP" ? "1" : "0.01";

  return (
    <>
      {header}
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-6">
        {cancelled && (
          <Alert tone="info" title={t("custom_apps:contract_editor.cancelled_title")}>
            {t("custom_apps:contract_editor.errors.cancelled")}
          </Alert>
        )}
        {failure && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {failure}
          </Alert>
        )}

        <RequiredLegend />

        <Section title={t("custom_apps:contract_editor.scope")} description={t("custom_apps:contract_editor.scope_hint")}>
          <Field
            label={t("custom_apps:contract_editor.fields.company")}
            htmlFor="contract-company"
            error={errors.companyId}
            hint={contractId ? t("custom_apps:contract_editor.hints.company_fixed") : undefined}
            help={help.field("contract_editor.help.company")}
            required={!contractId}
          >
            <CompanySelect
              id="contract-company"
              value={form.companyId}
              onChange={(value) => {
                set("companyId", value);
                set("appIds", []);
              }}
              disabled={Boolean(contractId)}
              invalid={Boolean(errors.companyId)}
            />
          </Field>
          <Field
            label={t("custom_apps:contract_editor.fields.name")}
            htmlFor="contract-name"
            error={errors.name}
            hint={t("custom_apps:contract_editor.hints.name")}
            help={help.field("contract_editor.help.name")}
            required
          >
            <Input
              id="contract-name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              maxLength={NAME_MAX}
              aria-invalid={Boolean(errors.name)}
              autoComplete="off"
              required
            />
          </Field>
          <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
            <FieldLegend label={t("custom_apps:contract_editor.apps")} help={help.field("contract_editor.help.apps")} />
            <p className="-mt-1 mb-1 text-xs text-neutral-500">{t("custom_apps:contract_editor.apps_hint")}</p>
            {!form.companyId ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-neutral-800 px-3 py-3 text-sm text-neutral-500">
                {t("custom_apps:contract_editor.apps_pick_company")}
              </p>
            ) : companyApps.loading && !companyApps.data ? (
              <p className="text-sm text-neutral-500">{t("admin:common.loading")}</p>
            ) : appRows.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("custom_apps:contract_editor.apps_empty")}</p>
            ) : (
              <CheckboxGroup
                idPrefix="contract-apps"
                options={appRows.map((app) => ({
                  value: app.id,
                  label: app.name,
                  hint: `${t(`custom_apps:kinds.${app.kind}`, {defaultValue: app.kind})} · ${t(`custom_apps:states.${app.state}`, {defaultValue: app.state})}`,
                }))}
                value={form.appIds}
                onChange={(value) => set("appIds", value)}
              />
            )}
          </fieldset>
        </Section>

        <Section title={t("custom_apps:contract_editor.term")} description={t("custom_apps:contract_editor.term_hint")}>
          <Field
            label={t("custom_apps:contract_editor.fields.starts_on")}
            htmlFor="contract-starts"
            error={errors.startsOn}
            hint={hasCycles ? t("custom_apps:contract_editor.hints.anchored") : undefined}
            help={help.field("contract_editor.help.starts_on")}
            required
          >
            <Input
              id="contract-starts"
              type="date"
              value={form.startsOn}
              onChange={(event) => set("startsOn", event.target.value)}
              disabled={hasCycles}
              aria-invalid={Boolean(errors.startsOn)}
              required
            />
          </Field>
          <Field
            label={t("custom_apps:contract_editor.fields.ends_on")}
            htmlFor="contract-ends"
            error={errors.endsOn}
            hint={t("custom_apps:contract_editor.hints.ends_on")}
            help={help.field("contract_editor.help.ends_on")}
          >
            <Input
              id="contract-ends"
              type="date"
              value={form.endsOn}
              min={form.startsOn || undefined}
              onChange={(event) => set("endsOn", event.target.value)}
              aria-invalid={Boolean(errors.endsOn)}
            />
          </Field>
          <CheckboxField
            id="contract-auto-renew"
            label={t("custom_apps:contract_editor.fields.auto_renew")}
            hint={
              form.autoRenew && !form.endsOn
                ? t("custom_apps:contract_editor.hints.auto_renew_no_end")
                : t("custom_apps:contract_editor.hints.auto_renew")
            }
            checked={form.autoRenew}
            onChange={(checked) => set("autoRenew", checked)}
            help={help.field("contract_editor.help.auto_renew")}
            className="sm:col-span-2"
          />
          {form.autoRenew && (
            <Field
              label={t("custom_apps:contract_editor.fields.renewal_months")}
              htmlFor="contract-renewal"
              error={errors.renewalMonths}
              hint={t("custom_apps:rules.range", RENEWAL_MONTHS)}
              help={help.field("contract_editor.help.renewal_months")}
              required
            >
              <Input
                id="contract-renewal"
                type="number"
                inputMode="numeric"
                min={RENEWAL_MONTHS.min}
                max={RENEWAL_MONTHS.max}
                value={form.renewalMonths}
                onChange={(event) => set("renewalMonths", event.target.value)}
                aria-invalid={Boolean(errors.renewalMonths)}
                className="font-mono"
              />
            </Field>
          )}
          <Field
            label={t("custom_apps:contract_editor.fields.notice_days")}
            htmlFor="contract-notice"
            error={errors.noticeDays}
            hint={t("custom_apps:contract_editor.hints.notice_days", {max: contractLimits.max_notice_days})}
            help={help.field("contract_editor.help.notice_days", {max: contractLimits.max_notice_days})}
            required
          >
            <Input
              id="contract-notice"
              type="number"
              inputMode="numeric"
              min={0}
              max={contractLimits.max_notice_days}
              value={form.noticeDays}
              onChange={(event) => set("noticeDays", event.target.value)}
              aria-invalid={Boolean(errors.noticeDays)}
              className="font-mono"
            />
          </Field>
        </Section>

        <Section title={t("custom_apps:contract_editor.price")} description={t("custom_apps:contract_editor.price_hint")}>
          <Field
            label={t("custom_apps:contract_editor.fields.amount")}
            htmlFor="contract-amount"
            error={errors.amount}
            help={help.field("contract_editor.help.amount")}
            required
          >
            <div className="flex gap-2">
              <Input
                id="contract-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step={decimals}
                value={form.amount}
                onChange={(event) => set("amount", event.target.value)}
                aria-invalid={Boolean(errors.amount)}
                className="font-mono"
              />
              <Select
                value={form.currency}
                onChange={(event) => set("currency", event.target.value as Currency)}
                aria-label={t("custom_apps:contract_editor.fields.currency")}
                className="w-28"
              >
                {vocabulary.currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
          <Field
            label={t("custom_apps:contract_editor.fields.billing_period")}
            htmlFor="contract-billing"
            help={help.field("contract_editor.help.billing_period")}
          >
            <Select id="contract-billing" value={form.billingPeriod} onChange={(event) => set("billingPeriod", event.target.value as BillingPeriod)}>
              {vocabulary.billingPeriods.map((period) => (
                <option key={period} value={period}>
                  {t(`custom_apps:billing_periods.${period}`, {defaultValue: period})}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section title={t("custom_apps:contract_editor.hours")} description={t("custom_apps:contract_editor.hours_hint")}>
          <Field
            label={t("custom_apps:contract_editor.fields.cycle_period")}
            htmlFor="contract-cycle"
            hint={hasCycles ? t("custom_apps:contract_editor.hints.anchored") : t("custom_apps:contract_editor.hints.cycle_period")}
            help={help.field("contract_editor.help.cycle_period")}
          >
            <Select
              id="contract-cycle"
              value={form.cyclePeriod}
              onChange={(event) => set("cyclePeriod", event.target.value as CyclePeriod)}
              disabled={hasCycles}
            >
              {vocabulary.cyclePeriods.map((period) => (
                <option key={period} value={period}>
                  {t(`custom_apps:cycle_periods.${period}`, {defaultValue: period})}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("custom_apps:contract_editor.fields.included_hours")}
            htmlFor="contract-included"
            error={errors.includedHours}
            hint={t("custom_apps:contract_editor.hints.included_hours")}
            help={help.field("contract_editor.help.included_hours")}
            required
          >
            <Input
              id="contract-included"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={form.includedHours}
              onChange={(event) => set("includedHours", event.target.value)}
              aria-invalid={Boolean(errors.includedHours)}
              className="font-mono"
            />
          </Field>
          <Field
            label={t("custom_apps:contract_editor.fields.overage_rate", {currency: form.currency})}
            htmlFor="contract-overage"
            error={errors.overageRate}
            hint={t("custom_apps:contract_editor.hints.overage_rate")}
            help={help.field("contract_editor.help.overage_rate")}
            required
          >
            <Input
              id="contract-overage"
              type="number"
              inputMode="decimal"
              min={0}
              step={decimals}
              value={form.overageRate}
              onChange={(event) => set("overageRate", event.target.value)}
              aria-invalid={Boolean(errors.overageRate)}
              className="font-mono"
            />
          </Field>
          <CheckboxField
            id="contract-rollover"
            label={t("custom_apps:contract_editor.fields.rollover")}
            hint={t("custom_apps:contract_editor.hints.rollover")}
            checked={form.rolloverEnabled}
            onChange={(checked) => set("rolloverEnabled", checked)}
            help={help.field("contract_editor.help.rollover")}
            className="sm:col-span-2"
          />
          {form.rolloverEnabled && (
            <>
              <Field
                label={t("custom_apps:contract_editor.fields.rollover_max_hours")}
                htmlFor="contract-rollover-hours"
                error={errors.rolloverMaxHours}
                hint={t("custom_apps:contract_editor.hints.rollover_max_hours")}
                help={help.field("contract_editor.help.rollover_max_hours")}
              >
                <Input
                  id="contract-rollover-hours"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={form.rolloverMaxHours}
                  onChange={(event) => set("rolloverMaxHours", event.target.value)}
                  aria-invalid={Boolean(errors.rolloverMaxHours)}
                  placeholder={t("custom_apps:contract_editor.no_limit")}
                  className="font-mono"
                />
              </Field>
              <Field
                label={t("custom_apps:contract_editor.fields.rollover_max_cycles")}
                htmlFor="contract-rollover-cycles"
                error={errors.rolloverMaxCycles}
                hint={t("custom_apps:contract_editor.hints.rollover_max_cycles")}
                help={help.field("contract_editor.help.rollover_max_cycles")}
              >
                <Input
                  id="contract-rollover-cycles"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={ROLLOVER_CYCLES_MAX}
                  value={form.rolloverMaxCycles}
                  onChange={(event) => set("rolloverMaxCycles", event.target.value)}
                  aria-invalid={Boolean(errors.rolloverMaxCycles)}
                  placeholder={t("custom_apps:contract_editor.no_limit")}
                  className="font-mono"
                />
              </Field>
            </>
          )}
        </Section>

        <Section title={t("custom_apps:contract_editor.grace")} description={t("custom_apps:contract_editor.grace_hint")}>
          <Field
            label={t("custom_apps:contract_editor.fields.grace_days")}
            htmlFor="contract-grace-days"
            error={errors.graceDays}
            hint={t("custom_apps:contract_editor.hints.grace_days", {max: contractLimits.max_grace_days})}
            help={help.field("contract_editor.help.grace_days", {max: contractLimits.max_grace_days})}
            required
          >
            <Input
              id="contract-grace-days"
              type="number"
              inputMode="numeric"
              min={0}
              max={contractLimits.max_grace_days}
              value={form.graceDays}
              onChange={(event) => set("graceDays", event.target.value)}
              aria-invalid={Boolean(errors.graceDays)}
              className="font-mono"
            />
          </Field>
          <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
            <FieldLegend label={t("custom_apps:contract_editor.fields.grace_allows")} help={help.field("contract_editor.help.grace_allows")} />
            <CheckboxGroup
              idPrefix="contract-grace-allows"
              options={vocabulary.graceAllowances.map((value) => ({
                value,
                label: t(`custom_apps:grace_allowances.${value}`, {defaultValue: value}),
                hint: t(`custom_apps:grace_allowances_hint.${value}`, {defaultValue: ""}) || undefined,
              }))}
              value={form.graceAllows}
              onChange={(value) => set("graceAllows", value as GraceAllowance[])}
            />
          </fieldset>
          <Field
            label={t("custom_apps:contract_editor.fields.grace_message")}
            htmlFor="contract-grace-message"
            error={errors.graceMessage}
            hint={t("custom_apps:contract_editor.hints.grace_message")}
            help={help.field("contract_editor.help.grace_message")}
            className="sm:col-span-2"
          >
            <Textarea
              id="contract-grace-message"
              value={form.graceMessage}
              onChange={(event) => set("graceMessage", event.target.value)}
              maxLength={GRACE_MESSAGE_MAX}
              rows={3}
              className="resize-y"
            />
          </Field>
        </Section>

        <Panel title={t("custom_apps:fields.notes")}>
          <Field
            label={t("custom_apps:fields.notes")}
            htmlFor="contract-notes"
            error={errors.notes}
            hint={t("custom_apps:contract_editor.hints.notes")}
            help={help.field("contract_editor.help.notes")}
          >
            <Textarea
              id="contract-notes"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              maxLength={NOTES_MAX}
              rows={4}
              className="resize-y"
            />
          </Field>
        </Panel>
      </form>
    </>
  );
};
