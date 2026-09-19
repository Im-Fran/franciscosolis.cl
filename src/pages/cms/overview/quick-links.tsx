import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight, EnvelopeSimple, PaperPlaneTilt, Scales} from "@phosphor-icons/react";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import type {Resource} from "@/lib/auth/useResource.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import type {OverviewData} from "@/pages/cms/overview/use-overview-data.ts";

const LinkRow = ({to, icon, label, hint, trailing}: {
  to: string;
  icon: ReactNode;
  label: string;
  hint: string;
  trailing?: ReactNode;
}) => (
  <li>
    <Link
      to={to}
      className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors hover:bg-neutral-800/40"
    >
      <span className="shrink-0 text-neutral-500" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text">{label}</span>
        <span className="block truncate text-[13px] text-neutral-500">{hint}</span>
      </span>
      {trailing}
      <ArrowRight size={14} className="shrink-0 text-neutral-600" aria-hidden="true"/>
    </Link>
  </li>
);

export type QuickLinksProps = Pick<OverviewData, "legal" | "templates"> & {className?: string};

/**
 * The rest of the interface, reachable from the landing rather than only from the sidebar.
 *
 * The two numbers here are real totals — `/admin/legal` and `/admin/email-templates` take no
 * `limit`, so the answer is the whole list — which is why these rows may show a bare count while
 * the "needs attention" tile has to qualify every one of its own. A row whose list failed or was
 * refused simply loses its badge and stays a working link.
 */
export const QuickLinks = ({legal, templates, className}: QuickLinksProps) => {
  const {t} = useTranslation(["cms_overview", "cms"]);

  const total = (resource: Resource<unknown[]>) => {
    if (resource.loading) {
      return <span aria-hidden="true" className="h-5 w-7 shrink-0 animate-pulse rounded-[var(--radius-sm)] bg-neutral-800/50"/>;
    }
    if (!resource.data) return null;
    return (
      <Badge size="sm" className="shrink-0" aria-label={t("cms_overview:links.total", {n: resource.data.length})}>
        {resource.data.length}
      </Badge>
    );
  };

  return (
    <Panel className={className} title={t("cms_overview:links.title")} description={t("cms_overview:links.description")}>
      <ul className="-mx-3 flex flex-col">
        <LinkRow
          to={cmsRoute.legal}
          icon={<Scales size={18}/>}
          label={t("cms:nav.legal")}
          hint={t("cms_overview:links.legal_hint")}
          trailing={total(legal)}
        />
        <LinkRow
          to={cmsRoute.templates}
          icon={<EnvelopeSimple size={18}/>}
          label={t("cms:nav.templates")}
          hint={t("cms_overview:links.templates_hint")}
          trailing={total(templates)}
        />
        <LinkRow
          to={cmsRoute.emailNew}
          icon={<PaperPlaneTilt size={18}/>}
          label={t("cms_overview:links.compose")}
          hint={t("cms_overview:links.compose_hint")}
        />
      </ul>
    </Panel>
  );
};
