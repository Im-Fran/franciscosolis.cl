import type {Contract} from "@/lib/custom-apps/types.ts";

/**
 * Where a work log is shown, which decides what it lists and how a new entry is filed:
 *
 * - a **company**'s whole log, where an entry may name one of its apps or none (work about the
 *   company as a whole) and the service picks the contract covering it;
 * - one **app**'s log, through the app's own routes, so the app is fixed;
 * - one **contract**'s log, where every entry is filed under that contract explicitly.
 */
export type WorkLogScope =
  | {kind: "company"; companyId: string}
  | {kind: "app"; appId: string; companyId: string}
  | {kind: "contract"; contract: Pick<Contract, "id" | "company_id" | "name" | "starts_on" | "ends_on" | "cancelled_at" | "apps">};

export const scopeCompanyId = (scope: WorkLogScope) =>
  scope.kind === "contract" ? scope.contract.company_id : scope.companyId;
