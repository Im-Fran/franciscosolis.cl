import type {ReactNode} from "react";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

/** What a list shows before anything has been created — an invitation, not an error. */
export const EmptyState = ({icon, title, description, action}: EmptyStateProps) => (
  <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
    {icon && <span className="text-neutral-600" aria-hidden="true">{icon}</span>}
    <p className="text-sm text-neutral-300">{title}</p>
    {description && <p className="max-w-md text-[13px] leading-relaxed text-neutral-500">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
