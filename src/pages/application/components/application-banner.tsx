import type {CSSProperties} from "react";
import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";
import {BookOpen, Envelope, Note, SquaresFour} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import {applicationRoute} from "@/lib/pages/config.ts";
import type {Application} from "@/lib/pages/types.ts";
import {ApplicationLinks} from "@/pages/application/components/application-links.tsx";

/**
 * The top of every product page: the banner, the name, and the row of tabs under it.
 *
 * This is the part that has to look identical across applications — it is what makes a dozen pages
 * read as one product family rather than a dozen sites. The only thing an application gets to
 * change about it is its artwork, its accent and *which* of the four tabs it turned on.
 */

/** Icon and route per tab key. The service decides which of these appear, and in what order. */
const TABS: Record<string, {icon: Icon; to: (slug: string) => string; labelKey: string}> = {
  overview: {icon: SquaresFour, to: applicationRoute.overview, labelKey: "application:tabs.overview"},
  updates: {icon: Note, to: applicationRoute.updates, labelKey: "application:tabs.updates"},
  wiki: {icon: BookOpen, to: applicationRoute.wiki, labelKey: "application:tabs.wiki"},
  contact: {icon: Envelope, to: applicationRoute.contact, labelKey: "application:tabs.contact"},
};

export const ApplicationBanner = ({application}: {application: Application}) => {
  const {t} = useTranslation(["application"]);
  const {slug, name, tagline, banner_image_url: banner, accent_color: accent, links} = application;

  /*
   * The accent is a plain custom property on this subtree rather than a class: it comes from the
   * API as an arbitrary hex value, and Tailwind cannot generate a class for a colour it has never
   * seen. Everything below reads `--page-accent` with a fallback, so an application that set no
   * accent is the site's own iris rather than a transparent one.
   */
  const accentStyle = accent ? ({"--page-accent": accent} as CSSProperties) : undefined;

  const tabs = application.tabs.filter((key) => key in TABS);

  return (
    <header style={accentStyle}>
      {banner ? (
        <div className="relative">
          {/*
            * `max-h` plus `object-contain` rather than a fixed aspect ratio: banner artwork arrives
            * at whatever shape its author drew it, and cropping somebody's logo out of their own
            * banner is worse than leaving space around it.
            */}
          <img
            src={banner}
            alt={t("application:banner_alt", {name})}
            className="mx-auto max-h-[340px] w-full max-w-5xl object-contain"
            loading="eager"
            decoding="async"
          />
        </div>
      ) : (
        /* No artwork: the name carries the header instead of a placeholder box pretending to be art. */
        <div className="px-4 pt-16 pb-6 text-center">
          <h1 className="text-[40px] leading-tight text-text">{name}</h1>
        </div>
      )}

      {banner && <h1 className="sr-only">{name}</h1>}

      {tagline && (
        <p className="mx-auto mt-4 max-w-2xl px-4 text-center text-[15px] leading-relaxed text-neutral-400">
          {tagline}
        </p>
      )}

      {links.length > 0 && <ApplicationLinks links={links} className="mt-6 px-4"/>}

      <nav
        aria-label={t("application:tabs.label")}
        className="mx-auto mt-8 flex max-w-full justify-start gap-1 overflow-x-auto px-4 sm:justify-center"
      >
        {tabs.map((key) => {
          const {icon: TabIcon, to, labelKey} = TABS[key];
          return (
            <NavLink
              key={key}
              to={to(slug)}
              /* Overview is the index route, so only it matches exactly; the rest own their subtree. */
              end={key === "overview"}
              className={({isActive}) =>
                cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-[var(--page-accent,var(--color-accent))] font-medium text-bg"
                    : "text-neutral-400 hover:bg-neutral-800/60 hover:text-text",
                )
              }
            >
              <TabIcon size={16} weight={key === "overview" ? "fill" : "regular"}/>
              {t(labelKey)}
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
};
