import {useTranslation} from "react-i18next";
import {
  ArrowSquareOut,
  BookOpen,
  DiscordLogo,
  DownloadSimple,
  GithubLogo,
  GitlabLogo,
  Globe,
  GooglePlayLogo,
  Heart,
  Lifebuoy,
} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {cn} from "@/lib/utils.ts";
import type {ApplicationLink} from "@/lib/pages/types.ts";

/**
 * The buttons under a banner, and the ones on a release note.
 *
 * `kind` is a closed vocabulary on the service precisely so this map can exist: a link says what
 * *sort* of destination it is and the page decides how to draw it, rather than every editor picking
 * an icon by hand and the set drifting. An unknown kind still renders — as the neutral outbound
 * arrow — because a kind the service adds later must not leave a blank button behind.
 */
const ICONS: Record<string, Icon> = {
  website: Globe,
  github: GithubLogo,
  gitlab: GitlabLogo,
  play_store: GooglePlayLogo,
  download: DownloadSimple,
  documentation: BookOpen,
  discord: DiscordLogo,
  support: Lifebuoy,
  sponsor: Heart,
};

/**
 * Apple does not let anyone draw their own App Store button: the badge is artwork they publish, per
 * language, and the identity guidelines ask that it be used as-is rather than redrawn with a local
 * icon and label. The files are served from `public/` rather than hotlinked so the badge keeps
 * working — and stops being a third party's view of who visits these pages.
 *
 * Only `en` and `es` are shipped because those are the only two languages this site speaks; a
 * language that is neither falls back to the English badge, which is what Apple distributes as the
 * default anyway.
 */
const APP_STORE_BADGES: Record<string, string> = {
  en: "/badges/mac-app-store-en.svg",
  es: "/badges/mac-app-store-es.svg",
};

/*
 * The badge artwork is 156.1 × 40. Apple asks for at least 40px of height on the web, so the two
 * sizes below sit at or above that instead of tracking the button heights exactly (44 and 36).
 */
const BADGE_HEIGHT = {lg: 44, sm: 40} as const;

export type ApplicationLinksProps = {
  links: ApplicationLink[];
  /** `lg` under a banner, `sm` on a release note where the links sit beside a version badge. */
  size?: "sm" | "lg";
  className?: string;
};

export const ApplicationLinks = ({links, size = "lg", className}: ApplicationLinksProps) => {
  const {t, i18n} = useTranslation(["application"]);

  if (links.length === 0) return null;

  const language = (i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0];
  const appStoreBadge = APP_STORE_BADGES[language] ?? APP_STORE_BADGES.en;

  return (
    <ul className={cn("flex flex-wrap items-center gap-2", className)}>
      {links.map((link) => {
        const LinkIcon = ICONS[link.kind] ?? ArrowSquareOut;
        const label = link.label?.trim() || t(`application:links.${link.kind}`, {defaultValue: link.kind});

        return (
          <li key={`${link.kind}:${link.url}`}>
            {/*
              * `noopener` is what keeps the opened tab from reaching back into this one through
              * `window.opener`; `noreferrer` is there because these are somebody else's stores
              * and repositories, and where a visitor came from is not theirs to collect.
              */}
            {link.kind === "app_store" ? (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-[10px] transition-opacity hover:opacity-80"
                data-fs-hover
              >
                {/*
                  * The badge already reads "Download on the Mac App Store", so the alt text is the
                  * editor's own label only when they wrote one — otherwise repeating the artwork's
                  * words is all a screen reader needs.
                  */}
                <img
                  src={appStoreBadge}
                  alt={link.label?.trim() || t("application:links.app_store_badge_alt")}
                  height={BADGE_HEIGHT[size]}
                  width={Math.round((BADGE_HEIGHT[size] * 156.10054) / 40)}
                  style={{height: BADGE_HEIGHT[size]}}
                  className="w-auto"
                  loading="lazy"
                  decoding="async"
                />
              </a>
            ) : (
              <Button
                asChild
                variant={size === "lg" ? "primary" : "ghost"}
                size={size === "lg" ? "default" : "sm"}
                data-fs-hover
              >
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <LinkIcon size={size === "lg" ? 18 : 15} weight="fill"/>
                  {label}
                </a>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
