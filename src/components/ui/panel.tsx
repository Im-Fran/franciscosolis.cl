import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {cn} from "@/lib/utils.ts";

export type PanelProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/** A titled section of a console screen. */
export const Panel = ({title, description, action, children, className, bodyClassName}: PanelProps) => (
  <section className={cn("rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-sm)]", className)}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 px-6 py-5">
      <div className="min-w-0">
        <h2 className="text-lg text-text">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
    <div className={cn("px-6 py-5", bodyClassName)}>{children}</div>
  </section>
);

export type PanelStateProps = {
  loading: boolean;
  error: string | null;
  /** Rendered instead of the error when the API refused the call. */
  forbidden?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
  /** i18n namespace holding the `common.*` and `errors.*` copy of the console this sits in. */
  ns?: string;
  children: ReactNode;
};

/** Loading, failure, no-access and empty rendered consistently across every list in a console. */
export const PanelState = ({
  loading,
  error,
  forbidden,
  empty,
  emptyLabel,
  onRetry,
  ns = "auth",
  children,
}: PanelStateProps) => {
  const {t} = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6 text-sm text-neutral-400">
        <Spinner size={18} label={t(`${ns}:common.loading`)}/>
        {t(`${ns}:common.loading`)}
      </div>
    );
  }

  if (forbidden) {
    return (
      <Alert tone="info" title={t(`${ns}:common.forbidden_title`)}>{t(`${ns}:common.forbidden_body`)}</Alert>
    );
  }

  if (error) {
    return (
      <Alert tone="error" title={t(`${ns}:common.failed`)}>
        <div className="flex flex-wrap items-center gap-3">
          <span>{t(`${ns}:errors.${error}`, {defaultValue: error})}</span>
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              <ArrowClockwise size={14}/> {t(`${ns}:common.retry`)}
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  if (empty) {
    return <p className="py-4 text-sm text-neutral-500">{emptyLabel ?? t(`${ns}:common.empty`)}</p>;
  }

  return <>{children}</>;
};
