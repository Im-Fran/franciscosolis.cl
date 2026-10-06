import {NotificationsList} from "@/pages/auth/account/notifications/notifications-list.tsx";
import {PreferencesPanel} from "@/pages/auth/account/notifications/preferences-panel.tsx";
import {PushPanel} from "@/pages/auth/account/notifications/push-panel.tsx";

/**
 * The tab: what arrived, then how it should reach you, then where.
 *
 * Three panels rather than three tabs, because they are one question asked from three ends — "why
 * did (or didn't) I hear about this" — and the answer usually needs a glance at the other two.
 */
export const NotificationsSection = () => (
  <div className="flex flex-col gap-6">
    <NotificationsList/>
    <PreferencesPanel/>
    <PushPanel/>
  </div>
);
