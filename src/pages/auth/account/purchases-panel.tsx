import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowClockwise, DownloadSimple, Receipt} from "@phosphor-icons/react";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {applicationRoute} from "@/lib/pages/config.ts";
import {pagesContent} from "@/lib/pages/content.ts";
import {formatAmount} from "@/lib/pages/store.ts";
import type {Purchase} from "@/lib/pages/types.ts";
import {Panel, PanelState} from "@/pages/auth/components/panel.tsx";

/**
 * What this account has paid for, and what it has downloaded since.
 *
 * Two panels rather than one screen per thing: they answer the same question from either end — "did
 * I pay for this" and "did I already get it" — and somebody looking for one usually wants a glance
 * at the other.
 *
 * Everything here is read-only, as the service is. A payment's status belongs to the payment
 * provider and arrives over its webhook, so there is nothing on this screen to change; a purchase
 * that went wrong is a support conversation, and the reference shown on each row is what that
 * conversation quotes.
 */
export const PurchasesPanel = () => (
  <div className="flex flex-col gap-6">
    <Payments/>
    <Downloads/>
  </div>
);

/** How a payment's state reads. Only `approved` is the one that entitles, so only it is accented. */
const statusTone = (purchase: Purchase) => {
  if (purchase.active) return "accent" as const;
  if (purchase.status === "pending" || purchase.status === "in_process") return "outline" as const;
  return "neutral" as const;
};

const Payments = () => {
  const {t, i18n} = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const purchases = useResource(useCallback((signal: AbortSignal) => pagesContent.purchases(signal), []));

  return (
    <Panel
      title={t("auth:account.purchases.title")}
      description={t("auth:account.purchases.description")}
      action={
        <Button variant="ghost" size="sm" onClick={purchases.reload}>
          <ArrowClockwise size={14}/> {t("auth:common.refresh")}
        </Button>
      }
    >
      <PanelState
        loading={purchases.loading && !purchases.data}
        error={purchases.error}
        empty={(purchases.data ?? []).length === 0}
        emptyLabel={t("auth:account.purchases.empty")}
        onRetry={purchases.reload}
      >
        <ul className="flex flex-col gap-3">
          {(purchases.data ?? []).map((purchase) => (
            <li
              key={purchase.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-md)] bg-bg/40 px-4 py-3"
            >
              <Receipt size={18} className="shrink-0 text-neutral-400"/>

              <span className="min-w-0 flex-1">
                <Link
                  to={applicationRoute.overview(purchase.application_slug)}
                  className="block truncate text-sm text-text underline-offset-2 hover:underline"
                >
                  {purchase.application_slug}
                </Link>
                <span className="block text-[12px] text-neutral-500">
                  {t(`auth:account.purchases.kind.${purchase.kind}`, {defaultValue: purchase.kind})}
                  {purchase.created_at ? ` · ${formatDateTime(purchase.created_at, locale)}` : ""}
                </span>
              </span>

              <span className="text-sm text-text">{formatAmount(purchase.amount, purchase.currency, locale)}</span>

              <Badge variant={statusTone(purchase)} size="sm">
                {t(`auth:account.purchases.status.${purchase.status}`, {defaultValue: purchase.status})}
              </Badge>
            </li>
          ))}
        </ul>
      </PanelState>
    </Panel>
  );
};

/**
 * The downloads this account has been served.
 *
 * Only the ones made while signed in are here, and that is not an omission: taking a free or
 * optional-pay build needs no account, so those downloads carry nobody and are not this account's
 * to list. The version and filename are the ones from the moment of the download, so a release
 * edited since still reads as what was actually taken.
 */
const Downloads = () => {
  const {t, i18n} = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const downloads = useResource(useCallback((signal: AbortSignal) => pagesContent.downloads(signal), []));

  return (
    <Panel
      title={t("auth:account.downloads.title")}
      description={t("auth:account.downloads.description")}
      action={
        <Button variant="ghost" size="sm" onClick={downloads.reload}>
          <ArrowClockwise size={14}/> {t("auth:common.refresh")}
        </Button>
      }
    >
      <PanelState
        loading={downloads.loading && !downloads.data}
        error={downloads.error}
        empty={(downloads.data ?? []).length === 0}
        emptyLabel={t("auth:account.downloads.empty")}
        onRetry={downloads.reload}
      >
        <ul className="flex flex-col gap-2">
          {(downloads.data ?? []).map((download) => (
            <li
              key={download.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-md)] bg-bg/40 px-4 py-2.5"
            >
              <DownloadSimple size={16} className="shrink-0 text-neutral-400"/>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text">{download.filename}</span>
                <span className="block text-[12px] text-neutral-500">
                  <Link
                    to={applicationRoute.updates(download.application_slug)}
                    className="underline-offset-2 hover:underline"
                  >
                    {download.application_slug}
                  </Link>
                  {" · "}
                  {download.version}
                </span>
              </span>

              <time dateTime={download.created_at} className="text-[12px] whitespace-nowrap text-neutral-500">
                {formatDateTime(download.created_at, locale)}
              </time>
            </li>
          ))}
        </ul>
      </PanelState>
    </Panel>
  );
};
