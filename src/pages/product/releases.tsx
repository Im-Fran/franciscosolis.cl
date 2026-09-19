import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {ArrowRight, Note} from "@phosphor-icons/react";
import {formatDate} from "@/lib/auth/format.ts";
import {productRoute} from "@/lib/marketplace/config.ts";
import {useProductOverview, useProductReleases} from "@/lib/marketplace/content.ts";
import {ALL_CHANNELS, RELEASE_CHANNELS, STABLE_CHANNEL} from "@/lib/marketplace/types.ts";
import {SectionError, SectionSkeleton} from "@/pages/home/components/section-state.tsx";
import {useProductPage} from "@/pages/product/product-context.ts";
import {ChannelBadge} from "@/pages/product/components/channel-badge.tsx";
import {ChannelPicker} from "@/pages/product/components/channel-picker.tsx";
import {ProductLinks} from "@/pages/product/components/product-links.tsx";
import {ProductProse} from "@/pages/product/components/product-prose.tsx";
import {ReleaseDownloads} from "@/pages/product/components/release-downloads.tsx";

/** The values `?channel=` may hold. Anything else is a typo and falls back to the stable line. */
const VALID_CHANNELS: string[] = [...RELEASE_CHANNELS, ALL_CHANNELS];

/**
 * The Releases tab: the product's changelog, newest release first.
 *
 * The order is the service's, and it is by the day a version *shipped* rather than by when the
 * entry was written — so a release somebody wrote up late lands where it belongs instead of at the
 * top. Nothing here re-sorts it.
 *
 * Every entry renders in full rather than collapsing behind a "read more". A changelog is a list of
 * short things, and an accordion over twenty two-line entries is a page that has to be clicked
 * twenty times to be read. What each entry *does* get is a way out to its own page, where the
 * compatibility, the full file list and the review form live — the list stays a list.
 *
 * It is also where the downloads live, because a build belongs to the release that published it:
 * that is what makes "the archive of past versions" a consequence of the changelog rather than a
 * second list somebody has to keep in step with it.
 *
 * The feed shows the **stable line** unless the picker asks for more. That default is the service's
 * too, and it is the important one: a visitor who opens a changelog has asked for what shipped, not
 * for what was built last night.
 */
export const ProductReleases = () => {
  const {t, i18n} = useTranslation(["product"]);
  const {slug} = useProductPage();
  const [params, setParams] = useSearchParams();

  /*
   * An unrecognised `?channel=` falls back to the stable line rather than being passed on. The
   * service *refuses* one — deliberately, so a typo cannot silently mean "everything" — and a 400
   * in place of a changelog is a worse answer to a mistyped URL than the changelog itself.
   */
  const asked = params.get("channel") ?? STABLE_CHANNEL;
  const channel = VALID_CHANNELS.includes(asked) ? asked : STABLE_CHANNEL;

  const releases = useProductReleases(slug, channel);
  /* Only for the counts beside each line; the sidebar owns this call and the service caches it. */
  const overview = useProductOverview(slug);

  const selectChannel = useCallback(
    (next: string) => {
      const updated = new URLSearchParams(params);
      /* The default stays out of the URL, so the plain address of the tab is the plain changelog. */
      if (next === STABLE_CHANNEL) updated.delete("channel");
      else updated.set("channel", next);
      setParams(updated, {replace: true});
    },
    [params, setParams],
  );

  const picker = (
    <ChannelPicker
      value={channel}
      counts={overview.data?.channels}
      onChange={selectChannel}
      className="mx-auto max-w-3xl pb-2"
    />
  );

  if (releases.loading) {
    return (
      <>
        {picker}
        <SectionSkeleton count={3} className="mx-auto max-w-3xl flex-col"/>
      </>
    );
  }

  if (releases.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionError error={releases.error} onRetry={releases.reload}/>
      </div>
    );
  }

  const rows = releases.data ?? [];

  if (rows.length === 0) {
    return (
      <>
        {picker}
        <p className="mx-auto flex max-w-3xl items-center justify-center gap-2 py-12 text-sm text-neutral-500">
          <Note size={18}/>
          {channel === STABLE_CHANNEL
            ? t("product:releases.empty")
            : t("product:releases.empty_channel", {
                channel: t(`product:channels.${channel}`, {defaultValue: channel}),
              })}
        </p>
      </>
    );
  }

  return (
    <>
      {picker}

      <ol className="mx-auto flex max-w-3xl flex-col gap-4">
        {rows.map((release) => (
          <li
            key={release.id}
            className="rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)]"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/*
                * The version is the identity of the entry, so it leads and is set in the accent — the
                * same treatment a tag gets everywhere else on the site. Monospace because a version
                * is a number somebody will compare against another one.
                */}
              <span className="rounded-[var(--radius-sm)] bg-[var(--page-accent,var(--color-accent))] px-2 py-0.5 font-mono text-[13px] font-medium text-bg">
                {release.version}
              </span>
              <ChannelBadge channel={release.channel}/>
              <h2 className="min-w-0 flex-1 text-[17px] leading-snug text-text">{release.title}</h2>
              {release.released_at && (
                <time dateTime={release.released_at} className="text-[13px] whitespace-nowrap text-neutral-500">
                  {formatDate(release.released_at, i18n.language)}
                </time>
              )}
            </div>

            {release.body?.trim() && <ProductProse source={release.body} className="mt-4 text-sm"/>}

            {release.links.length > 0 && <ProductLinks links={release.links} size="sm" className="mt-4"/>}

            <ReleaseDownloads slug={slug} channel={release.channel} version={release.version}/>

            {/*
              * The way out to the version's own page. A link rather than a button that swaps this
              * list for a panel: the detail view is a URL somebody links to, and "ver detalle" that
              * cannot be bookmarked is the same mistake the tab bar avoids.
              */}
            <Link
              to={productRoute.release(slug, release.channel, release.version)}
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent-300 hover:underline"
            >
              {t("product:releases.detail")} <ArrowRight size={14}/>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
};
