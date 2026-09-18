import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useCms} from "@/lib/cms/cms-context.ts";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {JumpBackIn} from "@/pages/cms/overview/jump-back-in.tsx";
import {NeedsAttention} from "@/pages/cms/overview/needs-attention.tsx";
import {QuickLinks} from "@/pages/cms/overview/quick-links.tsx";
import {RecentActivity} from "@/pages/cms/overview/recent-activity.tsx";
import {useOverviewData} from "@/pages/cms/overview/use-overview-data.ts";
import {YourAccess} from "@/pages/cms/overview/your-access.tsx";

/** Three greetings rather than a clock: enough to sound like a person, few enough to translate well. */
const greetingFor = (hour: number) => (hour >= 6 && hour < 12 ? "morning" : hour >= 12 && hour < 20 ? "afternoon" : "evening");

/** A greeting says hello to a person, not to an account, so the display name is cut to its first word. */
const firstNameOf = (name: string | null | undefined, email: string | undefined) => {
  const source = name?.trim() || email?.split("@")[0] || "";
  return source.split(/[\s._-]+/).filter(Boolean)[0] ?? "";
};

/**
 * What the CMS opens on: where to pick the work back up, what is waiting, what just happened, and
 * what this account is allowed to do.
 *
 * Every tile loads on its own and degrades on its own — a section this editor's role does not reach
 * answers 403 and goes quiet, rather than putting a failure across a screen whose other half is
 * perfectly fine.
 */
export const Overview = () => {
  const {t} = useTranslation(["cms_overview", "cms"]);
  const {me} = useAuth();
  const {editor, collections} = useCms();

  const data = useOverviewData(collections);

  const name = firstNameOf(me?.user.name ?? editor?.name, me?.user.email ?? editor?.email);
  const greeting = greetingFor(new Date().getHours());

  const refresh = () => {
    data.drafts.reload();
    data.failedEmails.reload();
    data.activity.reload();
    data.legal.reload();
    data.templates.reload();
  };

  return (
    <>
      <PageHeader
        title={t(name ? `cms_overview:greeting.${greeting}` : `cms_overview:greeting.${greeting}_anon`, {name})}
        description={t("cms_overview:subtitle")}
        actions={
          <Button variant="ghost" size="sm" onClick={refresh}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <JumpBackIn collections={collections} className="lg:col-span-3"/>
        <NeedsAttention drafts={data.drafts} failedEmails={data.failedEmails} className="lg:col-span-2"/>
        <QuickLinks legal={data.legal} templates={data.templates}/>
        <RecentActivity activity={data.activity} className="lg:col-span-2"/>
        <YourAccess editor={editor}/>
      </div>
    </>
  );
};
