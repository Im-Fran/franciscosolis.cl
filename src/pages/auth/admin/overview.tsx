import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {
  AppWindow,
  ArrowRight,
  CheckCircle,
  ClockCounterClockwise,
  EnvelopeSimple,
  Key,
  Monitor,
  ShieldCheck,
  Users,
  Warning,
} from "@phosphor-icons/react";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useOverviewData} from "@/pages/auth/admin/overview/use-overview-data.ts";

const QUICK_LINKS = [
  {to: adminRoute.users, label: "nav.users", icon: Users, permission: "users:read"},
  {to: adminRoute.invitations, label: "nav.invitations", icon: EnvelopeSimple, permission: "invitations:read"},
  {to: adminRoute.applications, label: "nav.applications", icon: AppWindow, permission: "applications:read"},
  {to: adminRoute.roles, label: "nav.roles", icon: ShieldCheck, permission: "roles:read"},
  {to: adminRoute.permissions, label: "nav.permissions", icon: Key, permission: "roles:read"},
  {to: adminRoute.sessions, label: "nav.sessions", icon: Monitor, permission: "sessions:read"},
  {to: adminRoute.audit, label: "nav.audit", icon: ClockCounterClockwise, permission: "audit:read"},
] as const;

/**
 * Where the console opens: what needs attention, what you hold, and what just happened.
 *
 * There are deliberately no totals on this screen. Every list endpoint on this API pages with
 * `limit`/`offset` and reports no count, so a figure here could only be the size of one page
 * dressed up as a total — a number that would be wrong every morning. What is counted instead are
 * the things this screen actually fetched in full and can therefore state honestly.
 */
export const Overview = () => {
  const {t, i18n} = useTranslation(["auth_admin", "admin"]);
  const {me, can} = useAdmin();
  const {invitations, applications, activity, attention} = useOverviewData();

  const loading = invitations.loading || applications.loading || activity.loading;

  return (
    <>
      <PageHeader
        title={t("auth_admin:overview.title")}
        description={t("auth_admin:overview.description", {email: me?.user.email ?? ""})}
      />

      <div className="flex flex-col gap-6">
        <Panel
          title={t("auth_admin:overview.attention_title")}
          description={t("auth_admin:overview.attention_description")}
        >
          {loading ? (
            <div className="flex items-center gap-3 py-2 text-sm text-neutral-400">
              <Spinner size={16}/> {t("admin:common.loading")}
            </div>
          ) : attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-neutral-400">
              <CheckCircle size={16} className="text-emerald-400"/> {t("auth_admin:overview.attention_clear")}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {attention.map((item) => (
                <li key={item.kind}>
                  <Alert tone={item.kind === "secrets_missing" ? "error" : "info"}>
                    <span className="flex flex-wrap items-center gap-2">
                      <Warning size={14}/>
                      <span>
                        {item.kind === "secrets_missing"
                          ? t("auth_admin:overview.attention.secrets_missing", {
                              clients: item.clients.join(", "),
                              count: item.clients.length,
                            })
                          : t(`auth_admin:overview.attention.${item.kind}`, {count: item.count})}
                      </span>
                      <Link
                        to={item.kind.startsWith("invitations") ? adminRoute.invitations : adminRoute.applications}
                        className="ml-auto inline-flex items-center gap-1 text-[13px] underline underline-offset-2"
                        data-fs-hover
                      >
                        {t("auth_admin:overview.review")} <ArrowRight size={12}/>
                      </Link>
                    </span>
                  </Alert>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("auth_admin:overview.access_title")} description={t("auth_admin:overview.access_description")}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-medium tracking-wider text-neutral-600 uppercase">
                  {t("auth_admin:overview.roles_label")}
                </p>
                {me && me.roles.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {me.roles.map((role) => (
                      <Badge key={role} variant="accent" size="sm">{role}</Badge>
                    ))}
                  </span>
                ) : (
                  <p className="text-sm text-neutral-500">{t("auth_admin:overview.roles_empty")}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-medium tracking-wider text-neutral-600 uppercase">
                  {t("auth_admin:overview.permissions_label")}
                </p>
                <span className="flex flex-wrap gap-1.5">
                  {(me?.permissions ?? []).map((permission) => (
                    <code
                      key={permission}
                      className="rounded-[var(--radius-sm)] bg-neutral-800/60 px-1.5 py-0.5 text-[11px] text-neutral-400"
                    >
                      {permission}
                    </code>
                  ))}
                </span>
              </div>

              {/*
                * Roles ride in the access token, so this is what the token says *and* what the
                * database said when it was minted. A grant made since then appears after the next
                * refresh; the API itself re-reads them per request and is never out of date.
                */}
              <p className="text-[13px] leading-relaxed text-neutral-500">{t("auth_admin:overview.access_note")}</p>
            </div>
          </Panel>

          <Panel title={t("auth_admin:overview.links_title")} description={t("auth_admin:overview.links_description")}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {QUICK_LINKS.filter((link) => can(link.permission)).map(({to, label, icon: Icon}) => (
                <li key={to}>
                  <Button variant="ghost" className="w-full justify-start" asChild data-fs-hover>
                    <Link to={to}>
                      <Icon size={16}/> {t(`auth_admin:${label}`)}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {can("audit:read") && (
          <Panel
            title={t("auth_admin:overview.activity_title")}
            description={t("auth_admin:overview.activity_description")}
            action={
              <Button variant="ghost" size="sm" asChild data-fs-hover>
                <Link to={adminRoute.audit}>
                  {t("auth_admin:overview.activity_all")} <ArrowRight size={14}/>
                </Link>
              </Button>
            }
          >
            {activity.loading ? (
              <div className="flex items-center gap-3 py-2 text-sm text-neutral-400">
                <Spinner size={16}/> {t("admin:common.loading")}
              </div>
            ) : (activity.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">{t("auth_admin:audit.empty")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-800">
                {(activity.data ?? []).map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="text-neutral-300">
                      {t(`auth_admin:events.${entry.event}`, {defaultValue: entry.event})}
                    </span>
                    {entry.user_email && <span className="truncate text-[13px] text-neutral-500">{entry.user_email}</span>}
                    <span className="ml-auto text-[12px] text-neutral-600">
                      {formatDateTime(entry.created_at, i18n.language)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </>
  );
};
