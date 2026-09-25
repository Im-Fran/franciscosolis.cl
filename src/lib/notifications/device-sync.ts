import {notificationsApi} from "@/lib/notifications/client.ts";
import {readStoredDevice, unsubscribe} from "@/lib/notifications/push.ts";

/**
 * Asks the service whether this browser's registration still exists, and lets go of the local
 * subscription when it does not.
 *
 * A registration can disappear without this browser taking part: somebody removes it from the
 * device list on another device, or the service prunes it after the push service bounced it. The
 * browser still holds a live `PushSubscription` and the stored id, so on its own it would keep
 * saying "enabled" while nothing is ever pushed to it — and the only way out was to disable and
 * enable again. Unsubscribing here is what makes the switch honest: the next "Enable" starts clean.
 *
 * Never re-registers. A removal made on purpose from another device must stick, and quietly putting
 * the row back is exactly what it would undo.
 *
 * Answers whether this browser is still registered. A request that fails leaves everything as it
 * was and answers `null`, since "could not ask" is not "gone".
 */
export const reconcileStoredDevice = async (sub: string): Promise<boolean | null> => {
  const stored = readStoredDevice();
  if (!stored || stored.sub !== sub) return false;

  let listed: boolean;
  try {
    listed = (await notificationsApi.devices()).some((device) => device.id === stored.id);
  } catch {
    return null;
  }

  /* Registered again while the list was in flight: that list predates the new row, so it proves nothing. */
  if (readStoredDevice()?.id !== stored.id) return null;
  if (listed) return true;

  await unsubscribe();
  return false;
};
