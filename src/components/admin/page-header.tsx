import type {ReactNode} from "react";
import {Link} from "react-router-dom";
import {ArrowLeft} from "@phosphor-icons/react";

export type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** A "back to the list" link, shown above the title on the screens that edit one record. */
  back?: {to: string; label: string};
  actions?: ReactNode;
};

/** The top of an administration screen: where it sits, what it is, and what can be done to it. */
export const PageHeader = ({title, description, back, actions}: PageHeaderProps) => (
  <header className="mb-8">
    {back && (
      <Link
        to={back.to}
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-text"
        data-fs-hover
      >
        <ArrowLeft size={14}/> {back.label}
      </Link>
    )}
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight text-text">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </header>
);
