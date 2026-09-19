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
 * Two kinds of tab draw from this: a section that is a *route* (the account's, whose triggers are
 * links) and a section of one screen that is not (an editor's, whose triggers are plain buttons —
 * splitting a form across routes would throw away what is typed on the way between them). Which one
 * a trigger is depends on whether it was given a `to`; nothing else about them differs.
 *
 * Activation is manual on purpose. The routed triggers are links, so selecting one is a navigation:
 * arrow keys move through them and Enter opens one, rather than every keypress pushing another
 * entry into the history. The in-page ones keep it for consistency — and because their sections are
 * whole forms, which is exactly the content the pattern says not to mount on a passing keypress.
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
  /**
   * Where the tab's section lives, when the sections are routes — a tab with one can be copied,
   * bookmarked and middle-clicked. Left off, the tab is a button and the selection stays on screen.
   */
  to?: string;
  /** Sits before the label, at the size the console navigation uses. */
  icon?: ReactNode;
  /**
   * Marks a section holding something that failed validation, so a form split across tabs cannot
   * refuse to save for a reason sitting behind a tab nobody is looking at.
   */
  invalid?: boolean;
};

/**
 * One tab: an anchor when it stands for a route, a button when it stands for a section of this
 * screen. The two are styled and announced identically — what changes is only whether following it
 * is a navigation.
 */
export const TabsTrigger = ({className, to, icon, invalid, children, ...props}: TabsTriggerProps) => {
  const body = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
      {invalid && (
        <span aria-hidden="true" className="ml-auto size-1.5 shrink-0 rounded-full bg-red-400"/>
      )}
    </>
  );

  return (
    <TabsPrimitive.Trigger
      asChild={Boolean(to)}
      /* Never a submit button: an in-page tab bar usually sits inside the form it is splitting up. */
      type={to ? undefined : "button"}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] whitespace-nowrap transition-colors",
        "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
        "data-[state=active]:bg-accent-900/50 data-[state=active]:text-accent-200",
        "lg:w-full lg:justify-start",
        className,
      )}
      {...props}
    >
      {to ? <Link to={to}>{body}</Link> : body}
    </TabsPrimitive.Trigger>
  );
};

export const TabsContent = ({className, ...props}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn("flex min-w-0 flex-col gap-6 focus-visible:outline-none", className)} {...props}/>
);
