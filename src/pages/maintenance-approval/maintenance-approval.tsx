import {useCallback, useEffect, useRef, useState} from "react";
import type {FormEvent, ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {ArrowClockwise, ArrowLeft, CalendarCheck, CheckCircle, Clock, ShieldWarning, XCircle} from "@phosphor-icons/react";
import {AuthCard} from "@/components/auth/auth-card.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {APPROVAL_LIMITS, ApprovalError, looksLikeToken, maintenanceApproval} from "@/lib/custom-apps/maintenance-approval.ts";
import type {ApprovalErrorKind, ApprovalLinkState, ApprovalView, ApprovalWindow} from "@/lib/custom-apps/maintenance-approval.ts";
import {formatZonedDateTime, formatZonedLongDate, formatZonedTime, formatZonedWindow, MAINTENANCE_TIMEZONE, zonedDay} from "@/lib/custom-apps/zoned-time.ts";
import {cn} from "@/lib/utils.ts";

const NS = "maintenance_approval";

/** Whole minutes as `2 h 30 min`, `45 min`. */
const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

type Load = {status: "loading"} | {status: "error"; kind: ApprovalErrorKind} | {status: "ready"; view: ApprovalView};

/** Why a write failed, sorted into what the page says about it. */
type Failure = {kind: ApprovalErrorKind; state: ApprovalLinkState | null};

const failureOf = (cause: unknown): Failure =>
  cause instanceof ApprovalError ? {kind: cause.kind, state: cause.state} : {kind: "unexpected", state: null};

/** One window the client can pick: the day in words, the hours, and whether it can still be chosen. */
const WindowCard = ({
  window,
  checked,
  disabled,
  onChange,
  language,
}: {
  window: ApprovalWindow;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  language: string;
}) => {
  const {t} = useTranslation(NS);
  const id = `maintenance-window-${window.id}`;
  const unavailable = !window.available;
  /* The instant just before the end, so a window ending at midnight stays on its own day. */
  const crossesMidnight =
    zonedDay(window.starts_at, MAINTENANCE_TIMEZONE) !== zonedDay(new Date(new Date(window.ends_at).getTime() - 1), MAINTENANCE_TIMEZONE);
  return (
    <li>
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-[3.5rem] items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 transition-colors",
          unavailable
            ? "cursor-not-allowed border-neutral-800 opacity-50"
            : checked
              ? "cursor-pointer border-accent bg-accent-900/30"
              : "cursor-pointer border-neutral-800 hover:border-neutral-600",
        )}
      >
        <input
          id={id}
          type="radio"
          name="window"
          value={window.id}
          checked={checked}
          disabled={disabled || unavailable}
          onChange={onChange}
          className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-text first-letter:uppercase">{formatZonedLongDate(window.starts_at, language, MAINTENANCE_TIMEZONE)}</span>
          <span className="mt-0.5 block text-[14px] text-neutral-300 tabular-nums">
            <span className="font-mono">
              {formatZonedTime(window.starts_at, language, MAINTENANCE_TIMEZONE)} – {formatZonedTime(window.ends_at, language, MAINTENANCE_TIMEZONE)}
            </span>
            {crossesMidnight && <span className="ml-1.5 text-[12px] text-neutral-500">{t("next_day")}</span>}
          </span>
          {unavailable && <span className="mt-0.5 block text-[12px] text-neutral-500">{t("window_unavailable")}</span>}
        </span>
      </label>
    </li>
  );
};

/**
 * The page a client opens from a maintenance request email, at `/mantencion/:token`.
 *
 * It is public on purpose: the person approving is the client's contact, who has no account on this
 * site and should not need one. The link is the credential — the service stores only its hash, each
 * recipient of each send has a link of their own, and it answers once — so this page sends no bearer
 * token and touches no session (see `src/lib/custom-apps/maintenance-approval.ts`), and the path is
 * served `noindex` and `no-referrer` (`public/_headers`).
 *
 * What it shows is what the email said: who it is for, what will be done, how long it takes, and the
 * windows offered, as cards on Santiago's clock. Picking one and pressing "Approve" schedules it;
 * "Reject" asks for a reason, which goes back to whoever planned it so it can be rescheduled. A link
 * that can no longer answer still reads — the page then says why (answered, superseded by a newer
 * email, expired, closed) and, once there is one, how the request ended.
 */
export const MaintenanceApproval = () => {
  const {t, i18n} = useTranslation(NS);
  const {token = ""} = useParams<{token: string}>();
  const language = i18n.language;
  const valid = looksLikeToken(token);

  const [load, setLoad] = useState<Load>(valid ? {status: "loading"} : {status: "error", kind: "not_found"});
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [justAnswered, setJustAnswered] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    setLoad((current) => (current.status === "ready" ? current : {status: "loading"}));
    maintenanceApproval
      .get(token, controller.signal)
      .then((view) => {
        if (!controller.signal.aborted) setLoad({status: "ready", view});
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({status: "error", kind: failureOf(cause).kind});
      });
    return () => controller.abort();
  }, [token, valid, nonce]);

  /* Moves focus to the outcome once the page changes under the person, so a screen reader hears it. */
  useEffect(() => {
    if (justAnswered) resultRef.current?.focus();
  }, [justAnswered]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const answer = async (kind: "approve" | "reject") => {
    setFailure(null);
    setPending(kind);
    try {
      const trimmedName = name.trim();
      const view =
        kind === "approve"
          ? await maintenanceApproval.approve(token, {window_id: selected, ...(trimmedName ? {name: trimmedName} : {})})
          : await maintenanceApproval.reject(token, {reason: reason.trim(), ...(trimmedName ? {name: trimmedName} : {})});
      setLoad({status: "ready", view});
      setRejecting(false);
      setJustAnswered(true);
    } catch (cause) {
      const found = failureOf(cause);
      setFailure(found);
      /* A link that stopped answering, or a window that started, changed what the page should show. */
      if (found.kind === "gone" || found.kind === "invalid") {
        setSelected("");
        reload();
      }
    } finally {
      setPending(null);
    }
  };

  const approve = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    void answer("approve");
  };

  const reject = (event: FormEvent) => {
    event.preventDefault();
    const value = reason.trim();
    if (!value) return setReasonError(t("reason_required"));
    if (value.length > APPROVAL_LIMITS.maxReasonLength) return setReasonError(t("reason_too_long", {max: APPROVAL_LIMITS.maxReasonLength}));
    void answer("reject");
  };

  const backHome = (
    <Link to="/" className="text-neutral-400 underline-offset-4 transition-colors hover:text-text">
      {t("back_home")}
    </Link>
  );

  if (load.status === "loading") {
    return (
      <AuthCard title={t("loading_title")} eyebrow={t("eyebrow")} className="max-w-xl">
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <Spinner size={18} label={t("loading_title")} />
          {t("loading_body")}
        </div>
      </AuthCard>
    );
  }

  if (load.status === "error") {
    const retryable = load.kind === "network" || load.kind === "rate_limited" || load.kind === "unexpected";
    return (
      <AuthCard title={t(`errors.${load.kind}.title`)} eyebrow={t("eyebrow")} footer={backHome} className="max-w-xl">
        <div className="flex flex-col gap-5">
          <Alert tone={load.kind === "not_found" ? "error" : "info"}>{t(`errors.${load.kind}.body`)}</Alert>
          {retryable && (
            <Button variant="secondary" onClick={reload}>
              <ArrowClockwise size={16} /> {t("retry")}
            </Button>
          )}
        </div>
      </AuthCard>
    );
  }

  const view = load.view;
  const outcome = view.outcome;
  const windows = [...view.windows].sort((a, b) => a.position - b.position);
  const who = [view.company_name, view.app_name].filter(Boolean).join(" · ");
  const busy = pending !== null;

  /* How the request ended, when it has; the link's own state otherwise. */
  let result: ReactNode = null;
  if (outcome) {
    const window = outcome.window ? formatZonedWindow(outcome.window.starts_at, outcome.window.ends_at, language, MAINTENANCE_TIMEZONE) : null;
    const tone = outcome.decision === "approved" || outcome.decision === "auto_applied" ? "success" : "info";
    result = (
      <Alert tone={tone} title={t(`outcome.${outcome.decision}.title`)}>
        <p>{t(`outcome.${outcome.decision}.body${outcome.answered_here ? "_here" : ""}`, {window})}</p>
        {outcome.decision === "rejected" && outcome.rejection_reason && (
          <blockquote className="mt-2 border-l-2 border-current/40 pl-3 whitespace-pre-line">{outcome.rejection_reason}</blockquote>
        )}
        {outcome.responded_at && (
          <p className="mt-2 text-[12px] opacity-80">{t("responded_at", {date: formatZonedDateTime(outcome.responded_at, language, MAINTENANCE_TIMEZONE)})}</p>
        )}
      </Alert>
    );
  } else if (!view.answerable) {
    result = (
      <Alert tone="info" title={t(`states.${view.state}.title`)}>
        {t(`states.${view.state}.body`)}
      </Alert>
    );
  }

  const failureMessage = failure
    ? failure.kind === "gone"
      ? t(`states.${failure.state ?? "closed"}.body`)
      : failure.kind === "invalid"
        ? t("errors.window_taken")
        : t(`errors.${failure.kind}.body`)
    : null;

  return (
    <AuthCard
      title={view.title}
      subtitle={who || undefined}
      eyebrow={view.kind === "security" ? t("eyebrow_security") : t("eyebrow")}
      footer={backHome}
      className="max-w-xl"
    >
      <div className="flex flex-col gap-6">
        <section aria-labelledby="maintenance-what" className="flex flex-col gap-3">
          <h2 id="maintenance-what" className="sr-only">
            {t("what_title")}
          </h2>
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-neutral-200">{view.description}</p>
          <p className="flex items-center gap-2 text-[13px] text-neutral-400">
            <Clock size={16} aria-hidden="true" /> {t("duration", {duration: duration(view.estimated_minutes)})}
          </p>
          {view.kind === "security" && (
            <p className="flex items-start gap-2 text-[13px] text-neutral-400">
              <ShieldWarning size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> {t("security_note")}
            </p>
          )}
        </section>

        <div ref={resultRef} tabIndex={-1} className="outline-none" aria-live="polite">
          {result}
        </div>

        {failureMessage && (
          <Alert tone="error" title={t("failed_title")}>
            {failureMessage}
          </Alert>
        )}

        {view.answerable && !rejecting && (
          <form onSubmit={approve} className="flex flex-col gap-5" noValidate>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-medium text-neutral-200">{t("choose_window")}</legend>
              <p className="-mt-1 text-[12px] leading-relaxed text-neutral-500">{t("timezone_note")}</p>
              {windows.length === 0 ? (
                <p className="text-[13px] text-neutral-500">{t("no_windows")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {windows.map((window) => (
                    <WindowCard
                      key={window.id}
                      window={window}
                      checked={selected === window.id}
                      disabled={busy}
                      onChange={() => setSelected(window.id)}
                      language={language}
                    />
                  ))}
                </ul>
              )}
            </fieldset>

            <Field label={t("name_label")} htmlFor="maintenance-name" hint={t("name_hint")}>
              <Input
                id="maintenance-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={APPROVAL_LIMITS.maxNameLength}
                autoComplete="name"
                disabled={busy}
              />
            </Field>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button type="submit" disabled={busy || !selected} className="w-full sm:w-auto">
                {pending === "approve" ? <Spinner size={16} /> : <CalendarCheck size={16} />}
                {t("approve")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                className="w-full sm:w-auto"
                onClick={() => {
                  setFailure(null);
                  setRejecting(true);
                }}
              >
                <XCircle size={16} /> {t("reject")}
              </Button>
            </div>
            {!selected && windows.some((window) => window.available) && <p className="text-[12px] text-neutral-500">{t("pick_first")}</p>}
            {view.expires_at && (
              <p className="text-[12px] text-neutral-500">{t("expires", {date: formatZonedDateTime(view.expires_at, language, MAINTENANCE_TIMEZONE)})}</p>
            )}
          </form>
        )}

        {view.answerable && rejecting && (
          <form onSubmit={reject} className="flex flex-col gap-5" noValidate>
            <p className="text-sm leading-relaxed text-neutral-300">{t("reject_intro")}</p>
            <Field label={t("reason_label")} htmlFor="maintenance-reason" hint={t("reason_hint", {max: APPROVAL_LIMITS.maxReasonLength})} error={reasonError} required>
              <Textarea
                id="maintenance-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError(null);
                }}
                maxLength={APPROVAL_LIMITS.maxReasonLength}
                rows={5}
                disabled={busy}
                aria-invalid={Boolean(reasonError)}
                required
                autoFocus
                className="resize-y"
              />
            </Field>
            <Field label={t("name_label")} htmlFor="maintenance-reject-name" hint={t("name_hint")}>
              <Input
                id="maintenance-reject-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={APPROVAL_LIMITS.maxNameLength}
                autoComplete="name"
                disabled={busy}
              />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button type="submit" variant="secondary" disabled={busy} className="w-full border-red-500/50 text-red-300 fs-ripple-danger sm:w-auto">
                {pending === "reject" ? <Spinner size={16} /> : <XCircle size={16} />}
                {t("reject_send")}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} className="w-full sm:w-auto" onClick={() => setRejecting(false)}>
                <ArrowLeft size={16} /> {t("reject_back")}
              </Button>
            </div>
          </form>
        )}

        {justAnswered && outcome && (outcome.decision === "approved" || outcome.decision === "rejected") && (
          <p className="flex items-center gap-2 text-[13px] text-neutral-400">
            <CheckCircle size={16} aria-hidden="true" /> {t("thanks")}
          </p>
        )}
      </div>
    </AuthCard>
  );
};
