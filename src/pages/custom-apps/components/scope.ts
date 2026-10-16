import type {TargetScope} from "@/lib/custom-apps/types.ts";

/** How specific a scope is, for "the most specific wins": installation, then channel, then app. */
export const scopeRank = (scope: TargetScope | string) => (scope === "installation" ? 2 : scope === "channel" ? 1 : 0);
