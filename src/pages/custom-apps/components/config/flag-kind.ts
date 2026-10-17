import type {FlagValue} from "@/lib/custom-apps/types.ts";

/** The three types a flag's value can have, as the form offers them. */
export type FlagKind = "boolean" | "string" | "number";

export const flagKindOf = (value: FlagValue): FlagKind =>
  typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string";
