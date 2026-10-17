import type {FlagValue} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";

/**
 * A flag's value as the device receives it, typed: `true` and `"true"` are different values to the
 * client app, so the string keeps its quotes and the boolean does not.
 */
export const FlagValueView = ({value}: {value: FlagValue}) => (
  <code
    className={cn(
      "rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-mono text-[12px] break-all",
      value === true
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
        : value === false
          ? "border-neutral-700 bg-neutral-800/60 text-neutral-400"
          : "border-neutral-700 bg-bg text-neutral-200",
    )}
  >
    {typeof value === "string" ? JSON.stringify(value) : String(value)}
  </code>
);
