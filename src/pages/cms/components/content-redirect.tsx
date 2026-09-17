import {Navigate} from "react-router-dom";
import {useCms, firstCollection} from "@/lib/cms/cms-context.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {useTranslation} from "react-i18next";

/**
 * `/cms/content` on its own names no collection, so it forwards to the first one the service
 * reports. A deployment that manages none has nothing to forward to, and says so.
 */
export const ContentRedirect = () => {
  const {t} = useTranslation();
  const {collections} = useCms();
  const slug = firstCollection(collections);

  if (slug) return <Navigate to={cmsRoute.content(slug)} replace/>;

  return <EmptyState title={t("cms:common.no_collections")}/>;
};
