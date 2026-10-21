import {lazy} from "react";

/*
 * The public maintenance approval page, split out of the main bundle: almost nobody opens it, and
 * those who do arrive straight from an email.
 */
export const MaintenanceApproval = lazy(() =>
  import("@/pages/maintenance-approval/maintenance-approval.tsx").then((m) => ({default: m.MaintenanceApproval})),
);
