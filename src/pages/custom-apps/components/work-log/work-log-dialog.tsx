import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {dayIn, formatDay} from "@/lib/custom-apps/format.ts";
import type {Contract, NewWorkLog, WorkKind, WorkLogEntry, WorkLogPayload} from "@/lib/custom-apps/types.ts";
import {coversDay} from "@/pages/custom-apps/components/contracts/contract-format.ts";
import {scopeCompanyId} from "@/pages/custom-apps/components/work-log/work-log-scope.ts";
import type {WorkLogScope} from "@/pages/custom-apps/components/work-log/work-log-scope.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";
import {FieldLegend, RequiredLegend} from "@/components/ui/help.tsx";
import {FormSection} from "@/pages/custom-apps/components/form-section.tsx";

const DESCRIPTION_MAX = 2000;

type Form = {
  day: string;
  hours: string;
  minutes: string;
  kind: WorkKind;
  description: string;
  link: string;
  /** Empty: work about the company as a whole. */
  appId: string;
  /** Empty: whichever contract the service finds covering the day. */
  contractId: string;
  /** Empty: not about a support ticket. */
  ticketId: string;
  /** Empty: not a scheduled maintenance. */
  maintenanceId: string;
};

/** What a new entry starts with, for the "log time" shortcut of a ticket's or a maintenance's page. */
export type WorkLogPreset = {
  ticketId?: string;
  ticketNumber?: number;
  maintenanceId?: string;
  maintenanceTitle?: string;
  kind?: WorkKind;
};

type FieldName = keyof Form;

const formOf = (entry: WorkLogEntry | null, today: string, fixedAppId: string, preset?: WorkLogPreset): Form => ({
  day: entry?.occurred_on ?? today,
  hours: entry ? String(Math.floor(entry.minutes / 60)) : "1",
  minutes: entry ? String(entry.minutes % 60) : "0",
  kind: entry?.kind ?? preset?.kind ?? "maintenance",
  description: entry?.description ?? "",
  link: entry?.link_url ?? "",
  appId: fixedAppId || (entry?.app_id ?? ""),
  contractId: entry?.contract_id ?? "",
  ticketId: entry ? (entry.ticket_id ?? "") : (preset?.ticketId ?? ""),
  maintenanceId: entry ? (entry.maintenance_id ?? "") : (preset?.maintenanceId ?? ""),
});

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

/** The service's answer when the day is covered by more than one contract and none was named. */
const asksForContract = (message: string | null) => Boolean(message && /contract_id is required|more than one contract/i.test(message));

/**
 * Logging work, or correcting an entry: the day, how long, what kind of work, what was done and a
 * link to it (a pull request, a ticket in the client's own tracker).
 *
 * The entry is filed by the service under the contract covering its app — or the company — on that
 * day, and under the cycle the day falls in. The dialog says beforehand which contract that will be,
 * and asks for one only when the day is covered by several: then the service refuses to guess (422),
 * and so does this form. A day inside a closed cycle is refused (409) because its balance was final
 * the moment it closed; the dialog says so in words rather than echoing the status.
 *
 * An entry may name the support ticket it answered — one of the app's tickets, or of the company's
 * when the work is about the company as a whole. The service refuses a ticket of another company.
 * In the same way it may name the scheduled maintenance it was — the app's, or the company's — which
 * a completed maintenance does on its own for the entry it files.
 */
export const WorkLogDialog = ({
  open,
  scope,
  entry,
  preset,
  onClose,
  onSaved,
}: {
  open: boolean;
  scope: WorkLogScope;
  /** Null creates an entry. */
  entry: WorkLogEntry | null;
  /** What a new entry starts with. Ignored when editing. */
  preset?: WorkLogPreset;
  onClose: () => void;
  onSaved: (entry: WorkLogEntry) => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const {workKinds, contractLimits, timezone} = useServiceVocabulary();
  const help = useHelp();
  const today = dayIn(new Date(), timezone);
  const companyId = scopeCompanyId(scope);
  /* Primitive keys, so a parent passing a fresh scope object on every render reloads nothing. */
  const fixedAppId = scope.kind === "app" ? scope.appId : "";
  const fixedContractId = scope.kind === "contract" ? scope.contract.id : "";

  const [form, setForm] = useState<Form>(() => formOf(entry, today, fixedAppId, preset));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  /* Set when the service answered that several contracts cover the day: the picker then stays up. */
  const [mustChoose, setMustChoose] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /* The company's apps, for an entry about one of them. A contract offers only the apps it covers. */
  const appsResource = useResource(
    useCallback(
      (signal: AbortSignal) =>
        scope.kind === "company" ? customAppsApi.apps.list({company_id: companyId, limit: 200}, signal) : Promise.resolve(null),
      [scope.kind, companyId],
    ),
  );
  const appOptions = useMemo(() => {
    if (scope.kind === "contract") return scope.contract.apps.map((app) => ({id: app.id, name: app.name}));
    return [...(appsResource.data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((app) => ({id: app.id, name: app.name}));
  }, [scope, appsResource.data]);

  /* The contracts that could take the entry. Not needed when the scope is a contract. */
  const contractsResource = useResource(
    useCallback(
      (signal: AbortSignal) => {
        if (fixedContractId) return Promise.resolve(null);
        return customAppsApi.contracts.list(
          fixedAppId ? {app_id: fixedAppId, limit: 200} : {company_id: companyId, limit: 200},
          signal,
        );
      },
      [fixedContractId, fixedAppId, companyId],
    ),
  );

  /**
   * What the service would choose between, mirrored: for an app, the contracts covering that app; for
   * the company as a whole, every contract of the company — on the entry's day either way.
   */
  const candidates = useMemo<Contract[]>(() => {
    if (scope.kind === "contract") return [];
    const rows = contractsResource.data?.data ?? [];
    return rows.filter(
      (contract) =>
        (!form.appId || scope.kind === "app" || contract.apps.some((app) => app.id === form.appId)) &&
        coversDay(contract, form.day, timezone),
    );
  }, [scope, contractsResource.data, form.appId, form.day, timezone]);

  const chosen = candidates.some((contract) => contract.id === form.contractId) ? form.contractId : "";

  /*
   * The tickets the entry could answer: the app's when it names one, the company's otherwise. The
   * hundred most recently active cover any ticket still being worked on.
   */
  const ticketAppId = fixedAppId || form.appId;
  const ticketsResource = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.tickets.list(ticketAppId ? {app_id: ticketAppId, limit: 100} : {company_id: companyId, limit: 100}, signal),
      [ticketAppId, companyId],
    ),
  );
  const ticketOptions = useMemo(() => {
    const rows = (ticketsResource.data?.data ?? []).map((ticket) => ({id: ticket.id, number: ticket.number, subject: ticket.subject}));
    /* The linked ticket stays selectable even when it is older than the loaded page. */
    const linked = entry?.ticket_id
      ? {id: entry.ticket_id, number: entry.ticket_number ?? null}
      : preset?.ticketId
        ? {id: preset.ticketId, number: preset.ticketNumber ?? null}
        : null;
    if (linked && !rows.some((row) => row.id === linked.id)) {
      rows.unshift({id: linked.id, number: linked.number ?? 0, subject: ""});
    }
    return rows;
  }, [ticketsResource.data, entry, preset]);
  /*
   * The maintenances the entry could be: the app's when it names one, the company's otherwise. The
   * hundred newest cover anything still being worked on.
   */
  const maintenancesResource = useResource(
    useCallback(
      (signal: AbortSignal) =>
        ticketAppId
          ? customAppsApi.maintenances.listForApp(ticketAppId, {limit: 100}, signal)
          : customAppsApi.maintenances.list({company_id: companyId, limit: 100}, signal),
      [ticketAppId, companyId],
    ),
  );
  const maintenanceOptions = useMemo(() => {
    const rows = (maintenancesResource.data?.data ?? [])
      .filter((maintenance) => maintenance.status !== "cancelled" || maintenance.id === (entry?.maintenance_id ?? preset?.maintenanceId))
      .map((maintenance) => ({id: maintenance.id, title: maintenance.title, status: maintenance.status}));
    const linked = entry?.maintenance_id
      ? {id: entry.maintenance_id, title: entry.maintenance_title ?? ""}
      : preset?.maintenanceId
        ? {id: preset.maintenanceId, title: preset.maintenanceTitle ?? ""}
        : null;
    if (linked && !rows.some((row) => row.id === linked.id)) rows.unshift({id: linked.id, title: linked.title, status: "completed" as const});
    return rows;
  }, [maintenancesResource.data, entry, preset]);

  const showPicker = scope.kind !== "contract" && (candidates.length > 1 || mustChoose);

  const save = useMutation(
    useCallback(
      (body: {create?: NewWorkLog; update?: WorkLogPayload}) => {
        if (entry && body.update) return customAppsApi.workLogs.update(entry.id, body.update);
        const created = body.create as NewWorkLog;
        if (fixedAppId) {
          const {app_id: _app, company_id: _company, ...rest} = created;
          return customAppsApi.workLogs.createForApp(fixedAppId, rest);
        }
        return customAppsApi.workLogs.create(created);
      },
      [entry, fixedAppId],
    ),
  );

  const {reset} = save;
  useEffect(() => {
    if (!open) return;
    setForm(formOf(entry, dayIn(new Date(), timezone), fixedAppId, preset));
    setErrors({});
    setMustChoose(false);
    setFailure(null);
    reset();
  }, [open, entry, preset, fixedAppId, timezone, reset]);

  const set = <K extends FieldName>(key: K, value: Form[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
    setFailure(null);
  };

  const totalMinutes = () => {
    const hours = Number(form.hours || 0);
    const minutes = Number(form.minutes || 0);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) return Number.NaN;
    return hours * 60 + minutes;
  };

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.day)) found.day = t("custom_apps:validation.required");
    else if (form.day > today) found.day = t("custom_apps:work_log.errors.future");
    else if (scope.kind === "contract" && !coversDay(scope.contract, form.day, timezone)) {
      found.day = t("custom_apps:work_log.errors.outside_contract");
    }
    const minutes = totalMinutes();
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > contractLimits.max_work_log_minutes) {
      found.hours = t("custom_apps:work_log.errors.duration", {max: contractLimits.max_work_log_minutes / 60});
    }
    const description = form.description.trim();
    if (!description) found.description = t("custom_apps:validation.required");
    else if (description.length > DESCRIPTION_MAX) found.description = t("custom_apps:validation.too_long", {max: DESCRIPTION_MAX});
    if (form.link.trim() && !isHttpUrl(form.link.trim())) found.link = t("custom_apps:work_log.errors.link");
    if (showPicker && !chosen) found.contractId = t("custom_apps:work_log.errors.choose_contract");
    return found;
  };

  const createBody = (): NewWorkLog => {
    const body: NewWorkLog = {
      occurred_on: form.day,
      minutes: totalMinutes(),
      kind: form.kind,
      description: form.description.trim(),
      link_url: orNull(form.link),
    };
    if (form.ticketId) body.ticket_id = form.ticketId;
    if (form.maintenanceId) body.maintenance_id = form.maintenanceId;
    if (scope.kind !== "app") {
      body.company_id = companyId;
      if (form.appId) body.app_id = form.appId;
    }
    if (scope.kind === "contract") body.contract_id = scope.contract.id;
    else if (chosen) body.contract_id = chosen;
    return body;
  };

  /** Only what changed, so an untouched entry is not refiled under a different contract by accident. */
  const updateBody = (current: WorkLogEntry): WorkLogPayload => {
    const body: WorkLogPayload = {};
    if (form.day !== current.occurred_on) body.occurred_on = form.day;
    const minutes = totalMinutes();
    if (minutes !== current.minutes) body.minutes = minutes;
    if (form.kind !== current.kind) body.kind = form.kind;
    if (form.description.trim() !== current.description) body.description = form.description.trim();
    if (orNull(form.link) !== (current.link_url ?? null)) body.link_url = orNull(form.link);
    if (scope.kind !== "app" && (form.appId || null) !== current.app_id) body.app_id = form.appId || null;
    /* Linking a ticket files nothing again: it only says what the work answered. */
    if ((form.ticketId || null) !== (current.ticket_id ?? null)) body.ticket_id = form.ticketId || null;
    if ((form.maintenanceId || null) !== (current.maintenance_id ?? null)) body.maintenance_id = form.maintenanceId || null;

    const refiled = body.occurred_on !== undefined || body.app_id !== undefined;
    if (scope.kind === "contract") {
      if (refiled) body.contract_id = scope.contract.id;
    } else if (chosen && (refiled || chosen !== current.contract_id)) {
      body.contract_id = chosen;
    } else if (!chosen && form.contractId !== (current.contract_id ?? "") && refiled) {
      body.contract_id = null;
    }
    return body;
  };

  const describeFailure = (status: number | null, message: string) => {
    if (status === 409) return t("custom_apps:work_log.errors.closed_cycle");
    if (status === 422 && /does not cover/i.test(message)) return t("custom_apps:work_log.errors.not_covered");
    if (status === 422 && /ticket_id/i.test(message)) return t("custom_apps:work_log.errors.ticket");
    if (status === 422 && /maintenance_id/i.test(message)) return t("custom_apps:work_log.errors.maintenance");
    if (status === 400 && /future/i.test(message)) return t("custom_apps:work_log.errors.future");
    return t(`admin:errors.${message}`, {defaultValue: message});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    let payload: {create?: NewWorkLog; update?: WorkLogPayload};
    if (entry) {
      const update = updateBody(entry);
      if (Object.keys(update).length === 0) {
        onClose();
        return;
      }
      payload = {update};
    } else {
      payload = {create: createBody()};
    }

    const outcome = await save.run(payload);
    if (outcome.ok) {
      onSaved(outcome.data);
      return;
    }
    if (outcome.status === 422 && asksForContract(outcome.error)) {
      setMustChoose(true);
      setErrors((current) => ({...current, contractId: t("custom_apps:work_log.errors.choose_contract")}));
      setFailure(null);
      return;
    }
    setFailure(describeFailure(outcome.status, outcome.error));
  };

  const pending = save.pending;
  const destination =
    scope.kind === "contract"
      ? t("custom_apps:work_log.files_under", {name: scope.contract.name})
      : showPicker
        ? null
        : candidates.length === 1
          ? t("custom_apps:work_log.files_under", {name: candidates[0].name})
          : contractsResource.data
            ? t("custom_apps:work_log.files_outside")
            : null;

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={entry ? t("custom_apps:work_log.edit_title") : t("custom_apps:work_log.create_title")}
      className="max-w-xl"
      help={help.form("work_log.form_help")}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <RequiredLegend className="-mt-2" />

        <FormSection title={t("custom_apps:work_log.sections.what")} bodyClassName="sm:grid-cols-2">
          {scope.kind !== "app" && (
            <Field
              label={t("custom_apps:work_log.fields.app")}
              htmlFor="work-log-app"
              hint={t("custom_apps:work_log.hints.app")}
              help={help.field("work_log.help.app")}
            >
              <Select
                id="work-log-app"
                value={form.appId}
                onChange={(event) => set("appId", event.target.value)}
                disabled={pending || (scope.kind === "company" && appsResource.loading)}
              >
                <option value="">{t("custom_apps:work_log.whole_company")}</option>
                {appOptions.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field
            label={t("custom_apps:work_log.fields.ticket")}
            htmlFor="work-log-ticket"
            error={errors.ticketId}
            hint={t("custom_apps:work_log.hints.ticket")}
            help={help.field("work_log.help.ticket")}
            className={scope.kind === "app" ? "sm:col-span-2" : undefined}
          >
            <Select
              id="work-log-ticket"
              value={form.ticketId}
              onChange={(event) => set("ticketId", event.target.value)}
              disabled={pending || (ticketsResource.loading && !ticketsResource.data)}
              aria-invalid={Boolean(errors.ticketId)}
            >
              <option value="">{t("custom_apps:work_log.no_ticket")}</option>
              {ticketOptions.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.number ? `#${ticket.number}` : t("custom_apps:work_log.fields.ticket")}
                  {ticket.subject ? ` · ${ticket.subject}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t("custom_apps:work_log.fields.maintenance")}
            htmlFor="work-log-maintenance"
            hint={t("custom_apps:work_log.hints.maintenance")}
            help={help.field("work_log.help.maintenance")}
            className="sm:col-span-2"
          >
            <Select
              id="work-log-maintenance"
              value={form.maintenanceId}
              onChange={(event) => set("maintenanceId", event.target.value)}
              disabled={pending || (maintenancesResource.loading && !maintenancesResource.data)}
            >
              <option value="">{t("custom_apps:work_log.no_maintenance")}</option>
              {maintenanceOptions.map((maintenance) => (
                <option key={maintenance.id} value={maintenance.id}>
                  {maintenance.title || t("custom_apps:work_log.fields.maintenance")}
                  {maintenance.status ? ` · ${t(`custom_apps:maintenance_statuses.${maintenance.status}`, {defaultValue: maintenance.status})}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("custom_apps:work_log.fields.kind")} htmlFor="work-log-kind" help={help.field("work_log.help.kind")}>
            <Select
              id="work-log-kind"
              value={form.kind}
              onChange={(event) => set("kind", event.target.value as WorkKind)}
              disabled={pending}
            >
              {workKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`custom_apps:work_kinds.${kind}`, {defaultValue: kind})}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t("custom_apps:work_log.fields.description")}
            htmlFor="work-log-description"
            error={errors.description}
            help={help.field("work_log.help.description")}
            required
            className="sm:col-span-2"
          >
            <Textarea
              id="work-log-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              disabled={pending}
              aria-invalid={Boolean(errors.description)}
              className="resize-y"
              required
            />
          </Field>
        </FormSection>

        <FormSection title={t("custom_apps:work_log.sections.when")} bodyClassName="sm:grid-cols-2">
          <Field label={t("custom_apps:work_log.fields.day")} htmlFor="work-log-day" error={errors.day} help={help.field("work_log.help.day")} required>
            <Input
              id="work-log-day"
              type="date"
              value={form.day}
              max={scope.kind === "contract" && scope.contract.ends_on && scope.contract.ends_on < today ? scope.contract.ends_on : today}
              min={scope.kind === "contract" ? scope.contract.starts_on : undefined}
              onChange={(event) => set("day", event.target.value)}
              disabled={pending}
              aria-invalid={Boolean(errors.day)}
              required
            />
          </Field>

          <fieldset className="flex flex-col gap-1.5">
            <FieldLegend
              label={t("custom_apps:work_log.fields.duration")}
              help={help.field("work_log.help.duration", {max: contractLimits.max_work_log_minutes / 60})}
              required
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={Math.floor(contractLimits.max_work_log_minutes / 60)}
                value={form.hours}
                onChange={(event) => set("hours", event.target.value)}
                disabled={pending}
                aria-label={t("custom_apps:work_log.fields.hours")}
                aria-invalid={Boolean(errors.hours)}
                className="w-20 font-mono"
              />
              <span className="text-sm text-neutral-500">h</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                step={5}
                value={form.minutes}
                onChange={(event) => set("minutes", event.target.value)}
                disabled={pending}
                aria-label={t("custom_apps:work_log.fields.minutes")}
                aria-invalid={Boolean(errors.hours)}
                className="w-20 font-mono"
              />
              <span className="text-sm text-neutral-500">min</span>
            </div>
            {errors.hours && <p className="text-xs text-red-400">{errors.hours}</p>}
          </fieldset>

          {destination && <p className="-mt-1 text-[12px] leading-relaxed text-neutral-500 sm:col-span-2">{destination}</p>}
        </FormSection>

        <Field
          label={t("custom_apps:work_log.fields.link")}
          htmlFor="work-log-link"
          error={errors.link}
          hint={t("custom_apps:work_log.hints.link")}
          help={help.field("work_log.help.link")}
        >
          <Input
            id="work-log-link"
            type="url"
            value={form.link}
            onChange={(event) => set("link", event.target.value)}
            placeholder="https://"
            disabled={pending}
            aria-invalid={Boolean(errors.link)}
          />
        </Field>

        {showPicker && (
          <Field
            label={t("custom_apps:work_log.fields.contract")}
            htmlFor="work-log-contract"
            error={errors.contractId}
            hint={t("custom_apps:work_log.hints.contract", {day: formatDay(form.day, language)})}
            help={help.field("work_log.help.contract")}
            required
          >
            <Select
              id="work-log-contract"
              value={chosen}
              onChange={(event) => set("contractId", event.target.value)}
              disabled={pending}
              aria-invalid={Boolean(errors.contractId)}
            >
              <option value="">{t("custom_apps:work_log.pick_contract")}</option>
              {candidates.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {failure && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {failure}
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t("admin:common.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
            {entry ? t("admin:common.save") : t("custom_apps:work_log.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
