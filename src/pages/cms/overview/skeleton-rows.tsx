import {useTranslation} from "react-i18next";

/**
 * Placeholder rows the same height as the real ones.
 *
 * The overview is a grid of tiles that finish loading at different moments; a one-line spinner
 * would let each tile grow as its data lands and shove the ones below it down the page. Reserving
 * the space up front is what keeps the layout still while the screen fills in.
 */
export const SkeletonRows = ({rows = 3}: {rows?: number}) => {
  const {t} = useTranslation(["cms_overview", "cms"]);

  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{t("admin:common.loading")}</span>
      {Array.from({length: rows}, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="h-11 animate-pulse rounded-[var(--radius-md)] bg-neutral-800/40"
        />
      ))}
    </div>
  );
};
