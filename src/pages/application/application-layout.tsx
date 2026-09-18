import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Link, Outlet, useParams} from "react-router-dom";
import {ArrowLeft, GlobeSimple} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {BrandLockup} from "@/components/brand";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {useApplication} from "@/lib/pages/content.ts";
import {SectionError} from "@/pages/home/components/section-state.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {ApplicationBanner} from "@/pages/application/components/application-banner.tsx";
import {ApplicationContext} from "@/pages/application/application-context.ts";

/**
 * The frame every tab of a product page sits in.
 *
 * The application is loaded once, here, rather than by each tab: the banner, the tab bar and the
 * body all need the same row, and four screens fetching it would reload the header on every tab
 * change. Everything below reads it from `ApplicationContext`, which is what lets a tab be a small
 * component that only knows about its own content.
 *
 * A slug the service does not publish is the site's own 404 rather than an error panel. From a
 * visitor's side there is no difference between an application that was never created and one that
 * is still a draft, and the service is deliberately unable to tell them apart either.
 */
export const ApplicationLayout = () => {
  const {t} = useTranslation(["application"]);
  const {slug = ""} = useParams<{slug: string}>();
  const {language, toggleLanguage} = useLanguageToggle();
  const resource = useApplication(slug);

  const value = useMemo(
    () => (resource.data ? {application: resource.data, slug} : null),
    [resource.data, slug],
  );

  if (resource.loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner size={28} label={t("application:loading")}/>
      </div>
    );
  }

  if (resource.status === 404) return <NotFound/>;

  if (resource.error || !value) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24">
        <SectionError error={resource.error ?? "unexpected"} onRetry={resource.reload}/>
      </div>
    );
  }

  /* The API says which language it actually served; asking for `es` does not guarantee getting it. */
  const untranslated = value.application.locale !== undefined && value.application.locale !== language;

  return (
    <ApplicationContext value={value}>
      <div className="flex flex-1 flex-col pb-24">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-text" data-fs-hover>
            <BrandLockup size={24} tone="auto"/>
            <span className="sr-only">{t("application:back_home")}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild data-fs-hover>
              <Link to="/">
                <ArrowLeft size={15}/>
                <span className="hidden sm:inline">{t("application:back_home")}</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              aria-label={t("common:toggle_lang", {lang: language === "es" ? "EN" : "ES"})}
              data-fs-hover
            >
              <GlobeSimple size={15}/> {language === "es" ? "EN" : "ES"}
            </Button>
          </div>
        </div>

        <ApplicationBanner application={value.application}/>

        {untranslated && (
          <p className="mx-auto mt-6 max-w-3xl px-4 text-center text-[13px] text-neutral-500">
            {t("application:untranslated")}
          </p>
        )}

        <main className="mx-auto mt-10 w-full max-w-6xl px-4">
          <Outlet/>
        </main>
      </div>
    </ApplicationContext>
  );
};
