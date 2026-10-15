import type {ReactNode} from "react";
import {cn} from "@/lib/utils.ts";

/** A record's facts as a definition list, the shape the auth console's user detail uses. */
export const DetailList = ({children, className}: {children: ReactNode; className?: string}) => (
  <dl className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</dl>
);

/** One fact. An absent value reads as a dash rather than leaving a hole in the grid. */
export const Detail = ({label, children, mono}: {label: string; children: ReactNode; mono?: boolean}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{label}</dt>
    <dd className={cn("text-sm break-words text-neutral-300", mono && "font-mono text-[13px]")}>
      {children === null || children === undefined || children === "" ? (
        <span className="text-neutral-600">—</span>
      ) : (
        children
      )}
    </dd>
  </div>
);
