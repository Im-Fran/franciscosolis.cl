import {useTranslation} from "react-i18next";
import {Eye, PencilSimple, StopCircle, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import type {AppMessage} from "@/lib/custom-apps/types.ts";
import {MessageStatusBadge, Pill, SeverityBadge} from "@/pages/custom-apps/components/badges.tsx";
import {ScopeLabel} from "@/pages/custom-apps/components/scope-fields.tsx";

/** One message as a card: what it says, to whom, when, and how many devices have shown it. */
export const MessageItem = ({
  message,
  names,
  onEdit,
  onEnd,
  onDelete,
  onReceipts,
  ending,
}: {
  message: AppMessage;
  names: Map<string, string>;
  onEdit: () => void;
  onEnd: () => void;
  onDelete: () => void;
  onReceipts: () => void;
  ending: boolean;
}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const language = i18n.language;
  const starts = formatDateTime(message.starts_at ?? message.created_at, language);
  const ends = formatDateTime(message.ends_at, language);

  return (
    <li className="rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text">{message.title}</span>
            <MessageStatusBadge value={message.status} />
            <SeverityBadge value={message.severity} />
            <Pill tone="inert">{t(`displays.${message.display}`, {defaultValue: message.display})}</Pill>
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line text-neutral-300">{message.body}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {message.status === "active" && (
            <Button variant="ghost" size="sm" onClick={onEnd} disabled={ending}>
              {ending ? <Spinner size={14} /> : <StopCircle size={14} />}
              {t("messages.end_now")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t("messages.edit_aria", {title: message.title})}>
            <PencilSimple size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={t("messages.delete_aria", {title: message.title})}>
            <Trash size={14} />
          </Button>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-500">
        <ScopeLabel scope={message.scope} value={message.scope_value} names={names} />
        <span aria-hidden="true" className="text-neutral-700">·</span>
        <span>
          {ends ? t("messages.window", {from: starts, to: ends}) : t("messages.window_open", {from: starts})}
        </span>
        <span aria-hidden="true" className="text-neutral-700">·</span>
        <button
          type="button"
          onClick={onReceipts}
          className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-text"
        >
          <Eye size={12} aria-hidden="true" />
          {t("messages.seen", {count: message.seen_count})}
        </button>
      </p>
    </li>
  );
};
