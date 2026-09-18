import {useTranslation} from "react-i18next";
import {Note} from "@phosphor-icons/react";
import {formatDate} from "@/lib/auth/format.ts";
import {useApplicationUpdates} from "@/lib/pages/content.ts";
import {SectionError, SectionSkeleton} from "@/pages/home/components/section-state.tsx";
import {useApplicationPage} from "@/pages/application/application-context.ts";
import {ApplicationLinks} from "@/pages/application/components/application-links.tsx";
import {ApplicationProse} from "@/pages/application/components/application-prose.tsx";

/**
 * The Updates tab: the application's changelog, newest release first.
 *
 * The order is the service's, and it is by the day a version *shipped* rather than by when the
 * entry was written — so a release somebody wrote up late lands where it belongs instead of at the
 * top. Nothing here re-sorts it.
 *
 * Every entry renders in full rather than collapsing behind a "read more". A changelog is a list of
 * short things, and an accordion over twenty two-line entries is a page that has to be clicked
 * twenty times to be read.
 */
export const ApplicationUpdates = () => {
  const {t, i18n} = useTranslation(["application"]);
  const {slug} = useApplicationPage();
  const updates = useApplicationUpdates(slug);

  if (updates.loading) return <SectionSkeleton count={3} className="mx-auto max-w-3xl flex-col"/>;

  if (updates.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionError error={updates.error} onRetry={updates.reload}/>
      </div>
    );
  }

  const rows = updates.data ?? [];

  if (rows.length === 0) {
    return (
      <p className="mx-auto flex max-w-3xl items-center justify-center gap-2 py-12 text-sm text-neutral-500">
        <Note size={18}/> {t("application:updates.empty")}
      </p>
    );
  }

  return (
    <ol className="mx-auto flex max-w-3xl flex-col gap-4">
      {rows.map((update) => (
        <li
          key={update.id}
          className="rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)]"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {/*
              * The version is the identity of the entry, so it leads and is set in the accent — the
              * same treatment a tag gets everywhere else on the site. Monospace because a version
              * is a number somebody will compare against another one.
              */}
            <span className="rounded-[var(--radius-sm)] bg-[var(--page-accent,var(--color-accent))] px-2 py-0.5 font-mono text-[13px] font-medium text-bg">
              {update.version}
            </span>
            <h2 className="min-w-0 flex-1 text-[17px] leading-snug text-text">{update.title}</h2>
            {update.released_at && (
              <time dateTime={update.released_at} className="text-[13px] whitespace-nowrap text-neutral-500">
                {formatDate(update.released_at, i18n.language)}
              </time>
            )}
          </div>

          {update.body?.trim() && <ApplicationProse source={update.body} className="mt-4 text-sm"/>}

          {update.links.length > 0 && <ApplicationLinks links={update.links} size="sm" className="mt-4"/>}
        </li>
      ))}
    </ol>
  );
};
