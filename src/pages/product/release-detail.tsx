import {useEffect} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {ArrowLeft, DownloadSimple, Eye} from "@phosphor-icons/react";
import {formatDate} from "@/lib/auth/format.ts";
import {productRoute} from "@/lib/marketplace/config.ts";
import {marketplaceContent, useProductRelease} from "@/lib/marketplace/content.ts";
import {SectionError, SectionSkeleton} from "@/pages/home/components/section-state.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {useProductPage} from "@/pages/product/product-context.ts";
import {ChannelBadge} from "@/pages/product/components/channel-badge.tsx";
import {CompatibilityList} from "@/pages/product/components/compatibility-list.tsx";
import {ProductLinks} from "@/pages/product/components/product-links.tsx";
import {ProductProse} from "@/pages/product/components/product-prose.tsx";
import {ReleaseDownloads} from "@/pages/product/components/release-downloads.tsx";
import {ReviewForm} from "@/pages/product/components/review-form.tsx";

/**
 * One version in full: its notes, what it runs on, the builds it published and the review form.
 *
 * This is what "ver detalle" on a changelog entry opens, and it is a **route** rather than a panel
 * the list swaps itself for. A version is exactly the kind of thing somebody links a colleague to —
 * "this is the build that broke it" — and a detail view that cannot be bookmarked is the same
 * mistake the tab bar exists to avoid.
 *
 * The address carries the channel as well as the version because the service keys a release on
 * both: `1.4.0` can exist as an `rc` and, a week later, as a `release`, and they are different
 * rows with different notes and different files.
 *
 * The review form sits here as well as on the Reviews tab, deliberately. Somebody who just read
 * what changed in a version is the person best placed to say something about it, and sending them
 * to another tab to do it is how a review does not get written. It is the same form and the same
 * one-per-product review either way — the service anchors it to the newest release the reviewer
 * could have obtained, not to the page it was submitted from.
 */
export const ProductReleaseDetail = () => {
  const {t, i18n} = useTranslation(["product"]);
  const {slug} = useProductPage();
  const {channel = "", version = ""} = useParams<{channel: string; version: string}>();
  const release = useProductRelease(slug, channel, version);

  const releaseId = release.data?.id;

  /*
   * A view of this *release*, counted once it is on screen. The service deduplicates per viewer, so
   * this is an estimate of attention rather than a record of people, and it is fire-and-forget:
   * a counter that could break the page it counts would be a bad trade.
   */
  useEffect(() => {
    if (!releaseId) return;
    void marketplaceContent.countView(slug, releaseId).catch(() => {});
  }, [slug, releaseId]);

  if (release.loading) return <SectionSkeleton count={2} className="mx-auto max-w-3xl flex-col"/>;

  /* A version that is not published is the site's own 404, exactly as an unpublished product is. */
  if (release.status === 404) return <NotFound/>;

  if (release.error || !release.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionError error={release.error ?? "unexpected"} onRetry={release.reload}/>
      </div>
    );
  }

  const data = release.data;
  const number = (value: number) => new Intl.NumberFormat(i18n.resolvedLanguage ?? "en").format(value);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        to={productRoute.releases(slug)}
        className="inline-flex items-center gap-1.5 self-start text-[13px] text-neutral-400 hover:text-text"
      >
        <ArrowLeft size={14}/> {t("product:releases.back")}
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[var(--radius-sm)] bg-[var(--page-accent,var(--color-accent))] px-2 py-0.5 font-mono text-sm font-medium text-bg">
            {data.version}
          </span>
          {/* Forced: on the version's own page the line is a fact about it, not an exception. */}
          <ChannelBadge channel={data.channel} force/>
        </div>

        <h1 className="text-2xl leading-tight text-text">{data.title}</h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-neutral-500">
          {data.released_at && (
            <time dateTime={data.released_at}>{formatDate(data.released_at, i18n.language)}</time>
          )}
          <span className="inline-flex items-center gap-1.5">
            <DownloadSimple size={14}/> {number(data.stats.download_count)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye size={14}/> {number(data.stats.view_count)}
          </span>
        </div>

        {data.resets_rating && (
          /*
           * Stated plainly, and stated as what it is: nothing was deleted. Every earlier review is
           * still on the Reviews tab and still readable — the average simply starts counting here.
           */
          <p className="rounded-[var(--radius-sm)] bg-surface px-4 py-3 text-[13px] text-neutral-400">
            {t("product:releases.resets_rating")}
          </p>
        )}
      </header>

      {data.body?.trim() && <ProductProse source={data.body}/>}

      {data.links.length > 0 && <ProductLinks links={data.links} size="sm"/>}

      {data.compatibility.length > 0 && (
        <section className="rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-[13px] tracking-wide text-neutral-500 uppercase">
            {t("product:compatibility.title")}
          </h2>
          {/*
            * Per version, which is the whole reason this list is here rather than on the product:
            * a release is exactly where support is added and dropped, and the version somebody is
            * about to download is the one whose requirements they need.
            */}
          <p className="mt-1 text-[13px] text-neutral-500">{t("product:compatibility.per_version")}</p>
          <CompatibilityList entries={data.compatibility} className="mt-4"/>
        </section>
      )}

      <ReleaseDownloads slug={slug} channel={data.channel} version={data.version}/>

      <ReviewForm slug={slug}/>
    </article>
  );
};
