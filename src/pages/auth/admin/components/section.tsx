import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import type {Resource} from "@/lib/auth/useResource.ts";

export type SectionStateProps = {
  /** Usually a `useResource` result; anything with the same four fields works. */
  resource: Pick<Resource<unknown>, "loading" | "error" | "status" | "reload">;
  /** Rendered when the request succeeded but came back with nothing. */
  empty?: ReactNode;
  isEmpty?: boolean;
  children: ReactNode;
};

/**
 * Loading, no-access, failure and empty for one section of the console.
 *
 * `/admin/me` already answered whether this account belongs here at all, but a *per-endpoint* 403
 * is a different question and still possible: a role that may read users and not the audit trail.
 * That is what this renders — where it happens, rather than as a dead end in the navigation.
 */
export const SectionState = ({resource, empty, isEmpty, children}: SectionStateProps) => {
  const {t} = useTranslation();

  if (resource.loading && !resource.error) {
    return (
      <div className="flex items-center gap-3 py-10 text-sm text-neutral-400">
        <Spinner size={18} label={t("admin:common.loading")}/>
        {t("admin:common.loading")}
      </div>
    );
  }

  if (resource.status === 403) {
    return (
      <Alert tone="info" title={t("admin:common.forbidden_title")}>{t("admin:common.forbidden_body")}</Alert>
    );
  }

  if (resource.error) {
    return (
      <Alert tone="error" title={t("admin:common.failed")}>
        <div className="flex flex-wrap items-center gap-3">
          <span>{t(`admin:errors.${resource.error}`, {defaultValue: resource.error})}</span>
          <Button variant="ghost" size="sm" onClick={resource.reload}>
            <ArrowClockwise size={14}/> {t("admin:common.retry")}
          </Button>
        </div>
      </Alert>
    );
  }

  if (isEmpty && empty) return <>{empty}</>;

  return <>{children}</>;
};

/** The card every list and form in the console sits on, so the sections share one surface. */
export const Surface = ({children, className}: {children: ReactNode; className?: string}) => (
  <section className={`rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)] ${className ?? ""}`}>
    {children}
  </section>
);
