import type {App, Command, CommandType, Installation} from "@/lib/custom-apps/types.ts";

/** Still on its way: waiting for the device, or picked up and not yet answered. */
export const isLive = (command: Pick<Command, "status">) => command.status === "pending" || command.status === "delivered";

/**
 * Why a command cannot be sent to this device, or null when it can. The service refuses the same
 * cases with a 409; saying so beside the option is cheaper than a round trip to learn it.
 */
export const commandUnavailable = (type: CommandType | string, app: App | null, installation: Installation) => {
  if (type === "restart_device" && app && app.kind !== "kiosk") return "restart_device";
  if (type === "screenshot" && !installation.screenshots_allowed) return "screenshot";
  return null;
};
