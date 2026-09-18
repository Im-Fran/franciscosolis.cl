import {useTranslation} from "react-i18next";
import {
  AppStoreLogo,
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
  app_store: AppStoreLogo,
  play_store: GooglePlayLogo,
  download: DownloadSimple,
  documentation: BookOpen,
  discord: DiscordLogo,
  support: Lifebuoy,
  sponsor: Heart,
};

export type ApplicationLinksProps = {
  links: ApplicationLink[];
  /** `lg` under a banner, `sm` on a release note where the links sit beside a version badge. */
  size?: "sm" | "lg";
  className?: string;
};

export const ApplicationLinks = ({links, size = "lg", className}: ApplicationLinksProps) => {
  const {t} = useTranslation(["application"]);

  if (links.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap items-center gap-2", className)}>
      {links.map((link) => {
        const LinkIcon = ICONS[link.kind] ?? ArrowSquareOut;
        const label = link.label?.trim() || t(`application:links.${link.kind}`, {defaultValue: link.kind});

        return (
          <li key={`${link.kind}:${link.url}`}>
            <Button
              asChild
              variant={size === "lg" ? "primary" : "ghost"}
              size={size === "lg" ? "default" : "sm"}
              data-fs-hover
            >
              {/*
                * `noopener` is what keeps the opened tab from reaching back into this one through
                * `window.opener`; `noreferrer` is there because these are somebody else's stores
                * and repositories, and where a visitor came from is not theirs to collect.
                */}
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <LinkIcon size={size === "lg" ? 18 : 15} weight="fill"/>
                {label}
              </a>
            </Button>
          </li>
        );
      })}
    </ul>
  );
};
