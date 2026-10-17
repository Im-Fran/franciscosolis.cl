import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Eye} from "@phosphor-icons/react";
import {Modal} from "@/components/ui/modal.tsx";
import {PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {AppMessage} from "@/lib/custom-apps/types.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";

const Receipts = ({message}: {message: AppMessage}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const receipts = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.messages.receipts(message.id, signal), [message.id]),
  );
  const rows = receipts.data?.data ?? [];

  return (
    <PanelState loading={receipts.loading} error={receipts.error} onRetry={receipts.reload} ns="admin">
      {rows.length === 0 ? (
        <EmptyState icon={<Eye size={28} />} title={t("custom_apps:messages.receipts_empty")} />
      ) : (
        <ul className="flex flex-col">
          {rows.map((receipt) => (
            <li
              key={receipt.installation_id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-neutral-800/70 py-2.5 last:border-0"
            >
              <Link to={customAppsRoute.installation(receipt.installation_id)} className="text-sm text-text hover:underline">
                {installationLabel(receipt)}
              </Link>
              <time dateTime={receipt.seen_at} title={receipt.seen_at} className="text-xs text-neutral-500">
                {formatDateTime(receipt.seen_at, i18n.language)}
                <span className="text-neutral-600"> · {formatLastSeen(receipt.seen_at, i18n.language)}</span>
              </time>
            </li>
          ))}
        </ul>
      )}
    </PanelState>
  );
};

/** Which devices have shown a message, and when each one first did. */
export const ReceiptsModal = ({message, onClose}: {message: AppMessage | null; onClose: () => void}) => {
  const {t} = useTranslation("custom_apps");
  return (
    <Modal
      open={message !== null}
      onClose={onClose}
      title={message ? t("messages.receipts_title", {title: message.title}) : undefined}
      className="max-w-lg"
    >
      {message && <Receipts message={message} />}
    </Modal>
  );
};
