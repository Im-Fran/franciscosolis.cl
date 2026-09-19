import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight, Calendar, DownloadSimple, Eye, ShoppingBag, Tag} from "@phosphor-icons/react";
import {formatDate} from "@/lib/auth/format.ts";
import {productRoute} from "@/lib/marketplace/config.ts";
import {formatAmount} from "@/lib/marketplace/money.ts";
import type {ProductOverview} from "@/lib/marketplace/types.ts";
import {ChannelBadge} from "@/pages/product/components/channel-badge.tsx";
import {CompatibilityList} from "@/pages/product/components/compatibility-list.tsx";
import {RatingStars} from "@/pages/product/components/rating-stars.tsx";

/**
 * The panel beside the Overview document: what this product is, how much of it there is, and what
 * the newest version looks like.
 *
 * It is chrome rather than a tab, deliberately — like the links row under the banner. A tab is
 * something a visitor navigates *to* after deciding the product is for them; this is part of that
 * decision, so it sits beside the first thing they read and nowhere else.
 *
 * Three labelling rules come from the service and are not re-decided here:
 *
 * - **Downloads is the headline number**, with purchases beside it rather than instead of it. A
 *   free product answers `null` for purchases and the row is simply absent — "0 purchases" is not
 *   a number anybody asked about on something that was never for sale.
 * - **A null rating is not zero stars.** It renders as "no ratings yet", because one empty star on
 *   a card reads as a verdict rather than as an absence.
 * - **The latest version's purchase count is an approximation** and is labelled as one. A purchase
 *   entitles the whole product and never names a release, so "bought while this version was
 *   current" is the most that can honestly be said.
 */
export const OverviewSidebar = ({slug, overview}: {slug: string; overview: ProductOverview}) => {
  const {t, i18n} = useTranslation(["product"]);
  const locale = i18n.resolvedLanguage ?? "en";
  const {stats, rating, pricing, latest_version: latest} = overview;

  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  /* `formatDate` answers null for an absent or unparseable date; a `<dd>` needs a string. */
  const date = (value: string | null | undefined) => formatDate(value, i18n.language);

  return (
    <aside className="flex w-full flex-col gap-5 lg:w-72 lg:shrink-0">
      <section className="rounded-[var(--radius-lg)] bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
        <dl className="flex flex-col gap-3">
          <Figure
            icon={<DownloadSimple size={15}/>}
            label={t("product:sidebar.downloads")}
            value={number(stats.download_count)}
          />

          {/* Absent, not zero, on a product that never took a payment. */}
          {stats.purchase_count !== null && stats.purchase_count !== undefined && (
            <Figure
              icon={<ShoppingBag size={15}/>}
              label={t("product:sidebar.purchases")}
              value={number(stats.purchase_count)}
            />
          )}

          <Figure icon={<Eye size={15}/>} label={t("product:sidebar.views")} value={number(stats.view_count)}/>

          {overview.product.category && (
            <Figure
              icon={<Tag size={15}/>}
              label={t("product:sidebar.category")}
              value={overview.product.category.name}
            />
          )}

          {date(stats.first_released_at) && (
            <Figure
              icon={<Calendar size={15}/>}
              label={t("product:sidebar.first_release")}
              value={date(stats.first_released_at) ?? ""}
            />
          )}

          {date(stats.last_released_at) && (
            <Figure
              icon={<Calendar size={15}/>}
              label={t("product:sidebar.last_release")}
              value={date(stats.last_released_at) ?? ""}
            />
          )}

          {pricing.mode === "paid" && pricing.price != null && (
            <Figure
              icon={<Tag size={15}/>}
              label={t("product:sidebar.price")}
              value={formatAmount(pricing.price, pricing.currency, locale)}
            />
          )}
        </dl>

        <div className="mt-4 border-t border-neutral-800/60 pt-4">
          <p className="text-[12px] tracking-wide text-neutral-500 uppercase">{t("product:sidebar.rating")}</p>
          {rating.average === null ? (
            /* Never zero stars. "Nobody has said yet" is a different thing from a bad score. */
            <p className="mt-1 text-sm text-neutral-500">{t("product:sidebar.no_ratings")}</p>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <RatingStars value={rating.average}/>
              <span className="text-sm text-text">{rating.average.toFixed(1)}</span>
              <span className="text-[13px] text-neutral-500">
                {t("product:sidebar.rating_count", {count: rating.count})}
              </span>
            </div>
          )}
          {rating.reset_at && (
            /*
             * Said out loud, because an average over a window nobody was told about is a number
             * that looks wrong to anyone who remembers the old one. Nothing was deleted; the
             * counting started again.
             */
            <p className="mt-1 text-[12px] text-neutral-500">
              {t("product:sidebar.rating_since", {date: date(rating.reset_at)})}
            </p>
          )}
        </div>
      </section>

      {latest && (
        <section className="rounded-[var(--radius-lg)] bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
          <p className="text-[12px] tracking-wide text-neutral-500 uppercase">
            {t("product:sidebar.latest_version")}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-[var(--radius-sm)] bg-[var(--page-accent,var(--color-accent))] px-2 py-0.5 font-mono text-[13px] font-medium text-bg">
              {latest.version}
            </span>
            <ChannelBadge channel={latest.channel}/>
          </div>

          <p className="mt-2 text-sm leading-snug text-text">{latest.title}</p>

          {latest.released_at && (
            <time dateTime={latest.released_at} className="mt-1 block text-[13px] text-neutral-500">
              {formatDate(latest.released_at, i18n.language)}
            </time>
          )}

          <dl className="mt-3 flex flex-col gap-2">
            {latest.download_count !== undefined && (
              <Figure
                icon={<DownloadSimple size={14}/>}
                label={t("product:sidebar.version_downloads")}
                value={number(latest.download_count)}
              />
            )}
            {latest.purchase_count !== null && latest.purchase_count !== undefined && (
              <Figure
                icon={<ShoppingBag size={14}/>}
                label={t("product:sidebar.version_purchases")}
                value={number(latest.purchase_count)}
                /* An approximation, and never labelled "bought this version". */
                hint={t("product:sidebar.version_purchases_hint")}
              />
            )}
          </dl>

          {latest.rating && (
            <div className="mt-3">
              <p className="text-[12px] tracking-wide text-neutral-500 uppercase">
                {t("product:sidebar.version_rating")}
              </p>
              {latest.rating.average === null ? (
                <p className="mt-1 text-sm text-neutral-500">{t("product:sidebar.no_ratings")}</p>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <RatingStars value={latest.rating.average} size={14}/>
                  <span className="text-[13px] text-neutral-500">
                    {t("product:sidebar.rating_count", {count: latest.rating.count})}
                  </span>
                </div>
              )}
            </div>
          )}

          {latest.compatibility && latest.compatibility.length > 0 && (
            <div className="mt-3 border-t border-neutral-800/60 pt-3">
              <p className="text-[12px] tracking-wide text-neutral-500 uppercase">
                {t("product:compatibility.title")}
              </p>
              <CompatibilityList entries={latest.compatibility} className="mt-2" compact/>
            </div>
          )}

          <Link
            to={productRoute.release(slug, latest.channel, latest.version)}
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent-300 hover:underline"
          >
            {t("product:releases.detail")} <ArrowRight size={14}/>
          </Link>
        </section>
      )}
    </aside>
  );
};

/** One labelled figure. A `<dl>` row, because that is what a label-and-value pair is. */
const Figure = ({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="flex items-center gap-1.5 text-[13px] text-neutral-500">
      <span className="translate-y-0.5 text-neutral-600">{icon}</span>
      {label}
    </dt>
    <dd className="text-right text-sm text-text" title={hint}>
      {value}
    </dd>
  </div>
);
