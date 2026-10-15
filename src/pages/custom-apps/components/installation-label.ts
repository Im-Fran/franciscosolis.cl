import type {InstallationSummary} from "@/lib/custom-apps/types.ts";

/**
 * What to call an installation: the alias somebody gave it, else the machine's own hostname, else
 * the device id the app generated — which is always there and never friendly.
 */
export const installationLabel = (installation: Pick<InstallationSummary, "alias" | "hostname" | "device_id">) =>
  installation.alias?.trim() || installation.hostname?.trim() || installation.device_id;

/** "Windows 11 · x64", from whatever parts the installation reported. */
export const describePlatform = (
  installation: Pick<InstallationSummary, "os_name" | "os_version" | "arch">,
) => [[installation.os_name, installation.os_version].filter(Boolean).join(" "), installation.arch].filter(Boolean).join(" · ");
