import {useTranslation} from "react-i18next";
import {useApplicationPage} from "@/pages/application/application-context.ts";
import {ApplicationProse} from "@/pages/application/components/application-prose.tsx";

/**
 * The Overview tab: one centred Markdown document, and nothing else.
 *
 * Deliberately narrow — `max-w-3xl` is around 70 characters at this size — because this is the one
 * page of an application meant to be *read* rather than scanned, and a line that spans a 27-inch
 * monitor is a line nobody finishes.
 */
export const ApplicationOverview = () => {
  const {t} = useTranslation(["application"]);
  const {application} = useApplicationPage();
  const body = application.overview_body?.trim();

  if (!body) {
    return (
      <p className="mx-auto max-w-3xl py-12 text-center text-sm text-neutral-500">
        {t("application:overview.empty")}
      </p>
    );
  }

  return <ApplicationProse source={body} className="mx-auto max-w-3xl"/>;
};
