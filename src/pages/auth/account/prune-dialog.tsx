import {useCallback, useEffect, useMemo, useState, type ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Broom, Warning} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {authApi} from "@/lib/auth/api.ts";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import type {Session, SessionPruneRequest, SessionPruneResult} from "@/lib/auth/types.ts";

/** The five conditions the service offers, in the order they read best on screen. */
const RULES = ["inactive", "older", "other_countries", "other_networks", "other_devices"] as const;
type Rule = (typeof RULES)[number];

type Draft = {
  selected: Record<Rule, boolean>;
  inactiveForDays: string;
  olderThanDays: string;
  match: "any" | "all";
  applications: string[];
  providers: string[];
};

const EMPTY: Draft = {
  selected: {inactive: false, older: false, other_countries: false, other_networks: false, other_devices: false},
  inactiveForDays: "30",
  olderThanDays: "180",
  match: "any",
  applications: [],
  providers: [],
};

/** A day count the service will accept: a whole number between 1 and ten years. */
const parseDays = (value: string) => {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 3650 ? days : null;
};

/** Builds the request body, or null when the draft does not describe a run the service would take. */
const toRequest = (draft: Draft): SessionPruneRequest | null => {
  const inactive = draft.selected.inactive ? parseDays(draft.inactiveForDays) : undefined;
  const older = draft.selected.older ? parseDays(draft.olderThanDays) : undefined;
  if (inactive === null || older === null) return null;

  const rules = {
    inactive_for_days: inactive,
    older_than_days: older,
    other_countries: draft.selected.other_countries || undefined,
    other_networks: draft.selected.other_networks || undefined,
    other_devices: draft.selected.other_devices || undefined,
  };
  if (Object.values(rules).every((value) => value === undefined)) return null;

  return {
    rules,
    match: draft.match,
    scope:
      draft.applications.length > 0 || draft.providers.length > 0
        ? {applications: draft.applications, providers: draft.providers}
        : undefined,
  };
};

const Toggle = ({
  checked,
  onChange,
  label,
  hint,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
  children?: ReactNode;
}) => (
  <div className="flex flex-col gap-2">
    <label className="flex items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1"/>
      <span>
        <span className="block text-[13px] text-neutral-300">{label}</span>
        <span className="block text-[12px] leading-relaxed text-neutral-600">{hint}</span>
      </span>
    </label>
    {checked && children && <div className="pl-7">{children}</div>}
  </div>
);

/** One value of a narrowing filter, rendered as a chip the way the console's filters are. */
const Chip = ({active, onClick, children}: {active: boolean; onClick: () => void; children: ReactNode}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`cursor-pointer rounded-[var(--radius-md)] border px-3 py-1.5 text-[13px] transition-colors ${
      active
        ? "border-accent bg-accent-900/40 text-accent-200"
        : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-text"
    }`}
    data-fs-hover
  >
    {children}
  </button>
);

export type PruneDialogProps = {
  open: boolean;
  onClose: () => void;
  /** The account's live sessions, used to offer only the applications and providers it actually has. */
  sessions: Session[];
  /** Called once a real run closed at least one session, so the list behind the dialog can reload. */
  onPruned: (result: SessionPruneResult) => void;
};

/**
 * "Close everything that is not this device", as a set of conditions rather than a list of rows.
 *
 * The whole point of the dialog is that nothing is destroyed on a guess: every change re-asks the
 * service with `dry_run`, so the list under the conditions is the service's own answer to "which
 * sessions would go", not this component's reading of the rules. The confirm button then sends the
 * exact same body without `dry_run`. Two things are worth knowing while reading it:
 *
 * - The current session is never in that list. The service refuses to prune it, so the button can
 *   never be the way somebody signs themselves out by accident.
 * - A session missing the field a condition reads — a location on a session older than the column,
 *   an address the edge could not see — is never matched by it, which is why the preview can come
 *   back shorter than the conditions suggest.
 */
export const PruneDialog = ({open, onClose, sessions, onPruned}: PruneDialogProps) => {
  const {t, i18n} = useTranslation();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [preview, setPreview] = useState<SessionPruneResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const prune = useMutation(useCallback((body: SessionPruneRequest) => authApi.pruneSessions(body), []));
  const {reset} = prune;

  const current = sessions.find((session) => session.current);
  const request = useMemo(() => toRequest(draft), [draft]);
  /* Serialised so the preview effect re-runs on a real change of the rules, not on every render. */
  const requestKey = request ? JSON.stringify(request) : null;

  const applications = useMemo(
    () => [...new Set(sessions.map((session) => session.application_id))].sort(),
    [sessions],
  );
  const providers = useMemo(() => [...new Set(sessions.map((session) => session.provider))].sort(), [sessions]);

  /* A fresh draft every time the dialog opens: a rule left ticked from last time is a trap. */
  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY);
    setPreview(null);
    setPreviewError(null);
    reset();
  }, [open, reset]);

  /* Asks the service what it would close, re-asked on every change and debounced for the number fields. */
  useEffect(() => {
    if (!open || !requestKey) {
      setPreview(null);
      setPreviewing(false);
      return;
    }

    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(() => {
      authApi
        .pruneSessions({...(JSON.parse(requestKey) as SessionPruneRequest), dry_run: true})
        .then((result) => {
          if (cancelled) return;
          setPreview(result);
          setPreviewError(null);
        })
        .catch(() => {
          if (!cancelled) setPreviewError("unexpected");
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, requestKey]);

  const toggle = (rule: Rule) => (value: boolean) =>
    setDraft((previous) => ({...previous, selected: {...previous.selected, [rule]: value}}));

  const toggleScope = (key: "applications" | "providers", value: string) =>
    setDraft((previous) => ({
      ...previous,
      [key]: previous[key].includes(value) ? previous[key].filter((entry) => entry !== value) : [...previous[key], value],
    }));

  const confirm = async () => {
    if (!request) return;
    const result = await prune.run(request);
    if (!result.ok) return;
    onPruned(result.data);
  };

  const matched = preview?.sessions.length ?? 0;

  return (
    <Modal open={open} onClose={prune.pending ? () => undefined : onClose} title={t("auth:account.prune.title")}
           className="max-w-xl">
      <div className="flex flex-col gap-5">
        <p className="text-sm leading-relaxed text-neutral-300">{t("auth:account.prune.description")}</p>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-sm font-medium text-neutral-300">{t("auth:account.prune.rules_label")}</legend>

          <Toggle
            checked={draft.selected.inactive}
            onChange={toggle("inactive")}
            label={t("auth:account.prune.inactive_label")}
            hint={t("auth:account.prune.inactive_hint")}
          >
            <label className="flex items-center gap-2 text-[13px] text-neutral-400">
              <Input
                type="number"
                min={1}
                max={3650}
                value={draft.inactiveForDays}
                onChange={(event) => setDraft((previous) => ({...previous, inactiveForDays: event.target.value}))}
                aria-invalid={parseDays(draft.inactiveForDays) === null}
                className="h-9 w-24"
              />
              {t("auth:account.prune.days")}
            </label>
          </Toggle>

          <Toggle
            checked={draft.selected.older}
            onChange={toggle("older")}
            label={t("auth:account.prune.older_label")}
            hint={t("auth:account.prune.older_hint")}
          >
            <label className="flex items-center gap-2 text-[13px] text-neutral-400">
              <Input
                type="number"
                min={1}
                max={3650}
                value={draft.olderThanDays}
                onChange={(event) => setDraft((previous) => ({...previous, olderThanDays: event.target.value}))}
                aria-invalid={parseDays(draft.olderThanDays) === null}
                className="h-9 w-24"
              />
              {t("auth:account.prune.days")}
            </label>
          </Toggle>

          <Toggle
            checked={draft.selected.other_countries}
            onChange={toggle("other_countries")}
            label={t("auth:account.prune.countries_label")}
            hint={
              current?.country
                ? t("auth:account.prune.countries_hint", {country: current.country})
                : t("auth:account.prune.countries_hint_unknown")
            }
          />

          <Toggle
            checked={draft.selected.other_networks}
            onChange={toggle("other_networks")}
            label={t("auth:account.prune.networks_label")}
            hint={t("auth:account.prune.networks_hint")}
          />

          <Toggle
            checked={draft.selected.other_devices}
            onChange={toggle("other_devices")}
            label={t("auth:account.prune.devices_label")}
            hint={t("auth:account.prune.devices_hint")}
          />
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-300">{t("auth:account.prune.match_label")}</span>
          <Select
            value={draft.match}
            onChange={(event) => setDraft((previous) => ({...previous, match: event.target.value as "any" | "all"}))}
          >
            <option value="any">{t("auth:account.prune.match_any")}</option>
            <option value="all">{t("auth:account.prune.match_all")}</option>
          </Select>
        </label>

        {(applications.length > 1 || providers.length > 1) && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-300">{t("auth:account.prune.scope_label")}</span>
            <span className="text-[12px] leading-relaxed text-neutral-600">{t("auth:account.prune.scope_hint")}</span>
            <div className="flex flex-wrap gap-2">
              {applications.length > 1 &&
                applications.map((application) => (
                  <Chip
                    key={application}
                    active={draft.applications.includes(application)}
                    onClick={() => toggleScope("applications", application)}
                  >
                    {application}
                  </Chip>
                ))}
              {providers.length > 1 &&
                providers.map((provider) => (
                  <Chip
                    key={provider}
                    active={draft.providers.includes(provider)}
                    onClick={() => toggleScope("providers", provider)}
                  >
                    {t(`auth:providers.${provider}`, {defaultValue: provider})}
                  </Chip>
                ))}
            </div>
          </div>
        )}

        <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-bg p-4">
          {!request ? (
            <p className="text-[13px] text-neutral-500">{t("auth:account.prune.pick_one")}</p>
          ) : previewing ? (
            <p className="flex items-center gap-2 text-[13px] text-neutral-500">
              <Spinner size={14}/> {t("auth:account.prune.checking")}
            </p>
          ) : previewError ? (
            <p className="text-[13px] text-red-400">{t("auth:errors.unexpected")}</p>
          ) : matched === 0 ? (
            <p className="text-[13px] text-neutral-500">{t("auth:account.prune.none")}</p>
          ) : (
            <>
              <p className="text-[13px] text-neutral-300">{t("auth:account.prune.matched", {count: matched})}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {preview?.sessions.map((session) => (
                  <li key={session.id} className="text-[12px] text-neutral-500">
                    <span className="text-neutral-400">
                      {describeUserAgent(session.user_agent) ?? t("auth:account.unknown_device")}
                    </span>
                    {" · "}
                    {[session.city, session.country, session.ip].filter(Boolean).join(" · ") ||
                      t("auth:account.prune.unknown_place")}
                    {" · "}
                    {t("auth:account.last_seen", {value: formatDateTime(session.last_seen_at, i18n.language)})}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <p className="text-[12px] leading-relaxed text-neutral-600">{t("auth:account.prune.keeps_current")}</p>

        {prune.error && (
          <Alert tone="error" title={t("auth:common.failed")}>
            {t(`auth:errors.${prune.error}`, {defaultValue: prune.error})}
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={prune.pending} data-fs-hover>
            {t("auth:common.cancel")}
          </Button>
          <Button
            variant="secondary"
            onClick={confirm}
            disabled={prune.pending || previewing || matched === 0}
            className="border-red-500/50 text-red-300 hover:bg-red-500/10"
            data-fs-hover
          >
            {prune.pending ? <Spinner size={16}/> : matched === 0 ? <Broom size={16}/> : <Warning size={16}/>}
            {t("auth:account.prune.confirm", {count: matched})}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
