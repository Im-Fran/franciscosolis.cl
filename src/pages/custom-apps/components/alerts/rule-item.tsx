import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {BellRinging, BellSlash, PencilSimple, Power, Trash, UserCircle} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {formatAlertValue, usesWindow} from "@/lib/custom-apps/alerts.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatDuration} from "@/lib/custom-apps/format.ts";
import type {AlertRule, AlertRulePayload} from "@/lib/custom-apps/types.ts";
import {AlertKindIcon} from "@/pages/custom-apps/components/alerts/alert-kind.tsx";
import {Pill} from "@/pages/custom-apps/components/badges.tsx";

/** How long a silence lasts, in hours. A silence is a pause with an end; disabling is the open-ended one. */
const SILENCE_HOURS = [1, 4, 24, 168] as const;

const isSilenced = (rule: AlertRule) =>
  Boolean(rule.silenced_until && new Date(rule.silenced_until).getTime() > Date.now());

/** One rule: what it watches, where, whether it is live, and the handful of things done to it. */
export const RuleItem = ({
  rule,
  busy,
  onUpdate,
  onEdit,
  onDelete,
}: {
  rule: AlertRule;
  busy: boolean;
  onUpdate: (body: AlertRulePayload, message: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const silenced = isSilenced(rule);

  const condition = t(`custom_apps:rules.condition.${rule.kind}`, {
    threshold: formatAlertValue(rule.kind, rule.threshold, language) ?? rule.threshold,
    window: formatDuration((rule.window_minutes || 0) * 60),
    defaultValue: rule.kind,
  });

  return (
    <li className="rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <AlertKindIcon kind={rule.kind} size={18} className="mt-0.5 shrink-0 text-neutral-500" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm text-text">
              {rule.name}
              {!rule.enabled ? (
                <Pill tone="inert">{t("custom_apps:rules.disabled")}</Pill>
              ) : silenced ? (
                <Pill tone="pending">{t("custom_apps:rules.silenced")}</Pill>
              ) : (
                <Pill tone="good">{t("custom_apps:rules.enabled")}</Pill>
              )}
            </p>
            <p className="mt-0.5 text-[13px] text-neutral-400">{condition}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-neutral-500">
              <span>
                {rule.app_id ? (
                  <Link to={customAppsRoute.app(rule.app_id)} className="hover:text-text hover:underline">
                    {rule.app_name ?? rule.app_id}
                  </Link>
                ) : (
                  t("custom_apps:rules.every_app")
                )}
              </span>
              {!usesWindow(rule.kind) ? null : (
                <span>{t("custom_apps:rules.window_value", {window: formatDuration(rule.window_minutes * 60)})}</span>
              )}
              {rule.notify_email && <span>{t("custom_apps:rules.notifies", {email: rule.notify_email})}</span>}
              {silenced && (
                <span className="text-amber-300/90">
                  {t("custom_apps:rules.silenced_until", {date: formatDateTime(rule.silenced_until, language)})}
                </span>
              )}
              <Link
                to={customAppsRoute.alerts({rule_id: rule.id, status: "unresolved"})}
                className={rule.open_alerts > 0 ? "text-red-300 hover:underline" : "hover:text-text hover:underline"}
              >
                {t("custom_apps:rules.open_alerts", {count: rule.open_alerts})}
              </Link>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {silenced ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onUpdate({silenced_until: null}, t("custom_apps:rules.unsilenced"))}
            >
              <BellRinging size={14} /> {t("custom_apps:rules.unsilence")}
            </Button>
          ) : (
            rule.enabled && (
              <Select
                value=""
                disabled={busy}
                aria-label={t("custom_apps:rules.silence")}
                onChange={(event) => {
                  const hours = Number(event.target.value);
                  if (!hours) return;
                  onUpdate(
                    {silenced_until: new Date(Date.now() + hours * 3_600_000).toISOString()},
                    t("custom_apps:rules.silenced_toast", {duration: formatDuration(hours * 3600)}),
                  );
                }}
                className="h-9 w-auto text-[13px]"
              >
                <option value="">{t("custom_apps:rules.silence")}</option>
                {SILENCE_HOURS.map((hours) => (
                  <option key={hours} value={hours}>
                    {t("custom_apps:rules.silence_for", {duration: formatDuration(hours * 3600)})}
                  </option>
                ))}
              </Select>
            )
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              onUpdate(
                {enabled: !rule.enabled},
                rule.enabled ? t("custom_apps:rules.disabled_toast") : t("custom_apps:rules.enabled_toast"),
              )
            }
          >
            {rule.enabled ? <BellSlash size={14} /> : <Power size={14} />}
            {rule.enabled ? t("custom_apps:rules.disable") : t("custom_apps:rules.enable")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onUpdate({notify_me: true}, t("custom_apps:rules.notify_me_toast"))}
            title={t("custom_apps:rules.notify_me_hint")}
          >
            <UserCircle size={14} /> {t("custom_apps:rules.notify_me")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t("custom_apps:rules.edit_aria", {name: rule.name})}>
            <PencilSimple size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={t("custom_apps:rules.delete_aria", {name: rule.name})}>
            <Trash size={14} />
          </Button>
        </div>
      </div>
    </li>
  );
};
