import {useCallback} from "react";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import type {InstallationSummary} from "@/lib/custom-apps/types.ts";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";

/**
 * Every installation of an app, for the pickers that target one device — a flag, a message, a log
 * filter. One page of 200 holds any fleet this panel is for; the usage screen makes the same bet.
 */
export const useAppInstallations = (appId: string) =>
  useResource(
    useCallback((signal: AbortSignal) => customAppsApi.apps.installations(appId, {limit: 200}, signal), [appId]),
  );

/** id → what to call it, for showing an installation-scoped row without a request per row. */
export const installationNames = (rows: InstallationSummary[] | undefined) =>
  new Map((rows ?? []).map((row) => [row.id, installationLabel(row)]));
