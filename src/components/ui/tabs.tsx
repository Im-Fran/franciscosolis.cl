import type {ComponentPropsWithoutRef, ReactNode} from "react";
import {Link} from "react-router-dom";
import {useMediaQuery} from "usehooks-ts";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {cn} from "@/lib/utils.ts";

/** The `lg` breakpoint, where the trigger list stops being a row and becomes a column. */
const COLUMN_QUERY = "(min-width: 64rem)";

/**
 * The console's tabbed sections, laid out as a column beside the panel.
 *
 * Radix owns the roving focus and the `aria-` wiring; what is added here is the shape the consoles
 * use — triggers beside the content above `lg`, and the same triggers as a row that scrolls
 * sideways below it, because a narrow screen has no room for a second column.
 *
 * Activation is manual on purpose. The triggers on these screens are links, so selecting a tab is
 * a navigation: arrow keys move through them and Enter opens one, rather than every keypress
 * pushing another entry into the history.
 */
export const Tabs = ({className, ...props}: ComponentPropsWithoutRef<typeof TabsPrimitive.Root>) => {
  /*
   * The orientation follows the layout rather than being fixed: below `lg` the triggers are a row,
   * and telling Radix they are a column would leave the arrow keys moving across them the wrong way.
   */
  const column = useMediaQuery(COLUMN_QUERY);

  return (
    <TabsPrimitive.Root
      orientation={column ? "vertical" : "horizontal"}
      activationMode="manual"
      className={cn("grid gap-6 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start", className)}
      {...props}
    />
  );
};

export const TabsList = ({className, ...props}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    className={cn(
      "-mx-4 flex gap-1 overflow-x-auto px-4 pb-1",
      "lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0",
      className,
    )}
    {...props}
  />
);

export type TabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  /** Where the tab's section lives. Each one is a route, so a tab can be linked to and opened in a new window. */
  to: string;
  /** Sits before the label, at the size the console navigation uses. */
  icon?: ReactNode;
};

/**
 * One tab. It is an anchor rather than a button: these sections are routes, and a tab that cannot
 * be copied, bookmarked or middle-clicked is a worse version of the link it is standing in for.
 */
export const TabsTrigger = ({className, to, icon, children, ...props}: TabsTriggerProps) => (
  <TabsPrimitive.Trigger
    asChild
    className={cn(
      "flex shrink-0 items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] whitespace-nowrap transition-colors",
      "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
      "data-[state=active]:bg-accent-900/50 data-[state=active]:text-accent-200",
      "lg:w-full lg:justify-start",
      className,
    )}
    {...props}
  >
    <Link to={to} data-fs-hover>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </Link>
  </TabsPrimitive.Trigger>
);

export const TabsContent = ({className, ...props}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn("flex min-w-0 flex-col gap-6 focus-visible:outline-none", className)} {...props}/>
);
