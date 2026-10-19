import type {ReactNode} from "react";
import {cn} from "@/lib/utils.ts";

/**
 * A titled group of fields inside one panel or dialog — lighter than a `Panel`, for forms whose
 * groups are a handful of fields each. Every section after the first is separated by a rule.
 */
export const FormSection = ({
  title,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** The grid the fields sit in; one column by default. */
  bodyClassName?: string;
}) => (
  <section className={cn("flex flex-col gap-4 [&+&]:border-t [&+&]:border-neutral-800 [&+&]:pt-5", className)}>
    <h3 className="text-[12px] font-medium tracking-wider text-neutral-500 uppercase">{title}</h3>
    <div className={cn("grid gap-5", bodyClassName)}>{children}</div>
  </section>
);
