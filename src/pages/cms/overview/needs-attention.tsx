import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight, FileDashed, WarningCircle} from "@phosphor-icons/react";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {cmsRoute} from "@/lib/cms/config.ts";
import {SkeletonRows} from "@/pages/cms/overview/skeleton-rows.tsx";
import {probeOf} from "@/pages/cms/overview/use-overview-data.ts";
import type {OverviewData, Probe} from "@/pages/cms/overview/use-overview-data.ts";

type Row = {to: string; icon: ReactNode; label: string; value: string};

const AttentionRow = ({to, icon, label, value}: Row) => (
  <li>
    <Link
      to={to}
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/30"
    >
      <span className="shrink-0 text-amber-300" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-text">{label}</span>
      <span className="shrink-0 text-[13px] text-neutral-400">{value}</span>
      <ArrowRight size={14} className="shrink-0 text-neutral-600" aria-hidden="true"/>
    </Link>
  </li>
);

export type NeedsAttentionProps = Pick<OverviewData, "drafts" | "failedEmails"> & {className?: string};

/**
 * The only tile that earns its place by finding problems: work left unpublished, and mail the
 * service could not deliver.
 *
 * A row exists only when there is something behind it. Zeroes are not news, so a quiet morning
 * gets one calm sentence instead of a wall of "0 drafts, 0 failures" that trains the eye to skip
 * the tile on the morning it does have something to say.
 */
export const NeedsAttention = ({drafts, failedEmails, className}: NeedsAttentionProps) => {
  const {t} = useTranslation(["cms_overview", "cms"]);

  /* Both numbers come off a page, so they are shown as "3" only when the page proved it was all. */
  const amount = (probe: Probe) => (probe.more ? `${probe.n}+` : String(probe.n));

  /* flatMap rather than filter so the surviving rows carry a `Probe` the compiler can see. */
  const draftRows = (drafts.data ?? []).flatMap((row) =>
    row.drafts && row.drafts.n > 0 ? [{collection: row.collection, drafts: row.drafts}] : [],
  );
  const failures = failedEmails.data ? probeOf(failedEmails.data) : null;

  const loading = drafts.loading || failedEmails.loading;
  const probesRefused = (drafts.data ?? []).every((row) => row.status === 403);
  const forbidden = failedEmails.status === 403 && probesRefused;
  const unreachable = Boolean(failedEmails.error) && (drafts.data ?? []).every((row) => row.drafts === null);

  /*
   * "Nothing waiting" is a claim about every source, so it is only made when every source actually
   * answered. When one of them was refused or unreachable the tile says what it can instead of
   * reassuring the reader about a list it never managed to read.
   */
  const everythingAnswered = failedEmails.data !== null && (drafts.data ?? []).every((row) => row.drafts !== null);

  const retry = () => {
    drafts.reload();
    failedEmails.reload();
  };

  return (
    <Panel
      className={className}
      title={t("cms_overview:attention.title")}
      description={t("cms_overview:attention.description")}
    >
      {loading ? (
        <SkeletonRows rows={2}/>
      ) : (
        <PanelState
          ns="cms"
          loading={false}
          error={unreachable ? failedEmails.error : null}
          forbidden={forbidden}
          onRetry={retry}
        >
          {draftRows.length === 0 && !failures?.n ? (
            <p className="py-1 text-sm leading-relaxed text-neutral-400">
              {t(everythingAnswered ? "cms_overview:attention.clear" : "cms_overview:attention.partial")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {draftRows.map((row) => (
                <AttentionRow
                  key={row.collection.slug}
                  to={cmsRoute.content(row.collection.slug)}
                  icon={<FileDashed size={18}/>}
                  label={row.collection.name}
                  value={t("cms_overview:attention.unpublished", {n: amount(row.drafts)})}
                />
              ))}

              {failures && failures.n > 0 && (
                <AttentionRow
                  to={cmsRoute.emails}
                  icon={<WarningCircle size={18}/>}
                  label={t("cms_overview:attention.failed_label")}
                  value={t("cms_overview:attention.undelivered", {n: amount(failures)})}
                />
              )}
            </ul>
          )}
        </PanelState>
      )}
    </Panel>
  );
};
