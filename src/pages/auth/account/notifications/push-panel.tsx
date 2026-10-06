import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, BellRinging, BellSlash, DeviceMobile, PaperPlaneTilt, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useA11y} from "@/lib/a11y";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {describeUserAgent, formatDate} from "@/lib/auth/format.ts";
import {describeError, useResource} from "@/lib/auth/useResource.ts";
import {notificationsApi} from "@/lib/notifications/client.ts";
import {reconcileStoredDevice} from "@/lib/notifications/device-sync.ts";
import {formatRelative} from "@/lib/notifications/format.ts";
import {
  currentSubscription,
  pushSupport,
  readStoredDevice,
  subscribe,
  subscriptionBody,
  unsubscribe,
  writeStoredDevice,
} from "@/lib/notifications/push.ts";
import type {PushDevice} from "@/lib/notifications/types.ts";
import {Panel, PanelState} from "@/pages/auth/components/panel.tsx";

type Notice = "dismissed" | "failed" | null;

/**
 * Web Push: this browser's switch, and every device the account registered.
 *
 * The switch is the part with states worth spelling out, because "it doesn't work" has several
 * different causes and each has a different fix: a browser with no Push API, an iPhone that has not
 * installed the site (Safari only exposes push to a home-screen app), a permission the person or
 * their browser already refused, and a service with no VAPID key configured. Each gets its own
 * sentence instead of a disabled button.
 *
 * Which row in the list is *this* browser is remembered locally when it registers — the service's
 * list carries no endpoint, deliberately, since an endpoint is a capability to push to someone.
 */
export const PushPanel = () => {
  const {t} = useTranslation(["notifications", "auth"]);
  const {preferences} = useA11y();
  const language = preferences.language;
  const {me} = useAuth();
  const {notify} = useToast();
  const sub = me?.user.id ?? null;

  const support = pushSupport();
  const status = useResource(useCallback((signal: AbortSignal) => notificationsApi.status(signal), []));
  const devices = useResource(useCallback((signal: AbortSignal) => notificationsApi.devices(signal), []));
  const vapidKey = status.data?.push.vapid_public_key ?? null;

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    support === "supported" ? Notification.permission : "default",
  );
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [removing, setRemoving] = useState<PushDevice | null>(null);

  /*
   * Which registered row, if any, is the subscription this browser holds right now. Local storage
   * alone is not enough: the row may have been removed from another device, in which case the list
   * no longer carries it and the local subscription is dropped rather than shown as enabled.
   */
  const list = devices.data;
  const detect = useCallback(async () => {
    const stored = readStoredDevice();
    const subscription = await currentSubscription();
    const held = subscription && stored && sub && stored.sub === sub && stored.endpoint === subscription.endpoint;
    if (!held) {
      setThisDevice(null);
      return;
    }
    if (list && !list.some((device) => device.id === stored.id)) {
      /* Confirmed against a fresh list, so a list fetched before this browser registered cannot undo it. */
      const registered = await reconcileStoredDevice(sub);
      setThisDevice(registered === false ? null : stored.id);
      return;
    }
    setThisDevice(stored.id);
  }, [sub, list]);

  useEffect(() => {
    void detect();
  }, [detect]);

  /* Coming back to this tab after removing it elsewhere should not need a manual refresh. */
  const reloadDevices = devices.reload;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reloadDevices();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reloadDevices]);

  const enable = async () => {
    if (!vapidKey || !sub) return;
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await subscribe(vapidKey);
      if (support === "supported") setPermission(Notification.permission);
      if (!outcome.ok) {
        if (outcome.reason === "dismissed" || outcome.reason === "failed") setNotice(outcome.reason);
        return;
      }
      const device = await notificationsApi.registerDevice(subscriptionBody(outcome.subscription));
      writeStoredDevice({id: device.id, endpoint: outcome.subscription.endpoint, sub});
      setThisDevice(device.id);
      notify(t("notifications:push.enabled_toast"));
      devices.reload();
    } catch (cause) {
      const message = describeError(cause).message;
      notify(t(`auth:errors.${message}`, {defaultValue: message}), "error");
    } finally {
      setBusy(false);
    }
  };

  /** Removes a row, and when it is this browser's, drops the local subscription with it. */
  const removeDevice = useMutation(
    useCallback(async (id: string) => {
      await notificationsApi.removeDevice(id);
      if (readStoredDevice()?.id === id) await unsubscribe();
    }, []),
  );

  const disable = async () => {
    if (!thisDevice) return;
    const result = await removeDevice.run(thisDevice);
    /* A row the service no longer has is as removed as it gets; the local half still has to go. */
    if (!result.ok && result.status !== 404) {
      notify(t(`auth:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }
    if (!result.ok) await unsubscribe();
    setThisDevice(null);
    notify(t("notifications:push.disabled_toast"));
    devices.reload();
  };

  const test = useMutation(useCallback(() => notificationsApi.testPush(), []));
  const sendTest = async () => {
    const result = await test.run();
    if (!result.ok) {
      notify(t(`auth:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }
    notify(
      result.data.sent > 0 ? t("notifications:push.test_sent", {count: result.data.sent}) : t("notifications:push.test_none"),
      result.data.sent > 0 ? "success" : "info",
    );
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const result = await removeDevice.run(removing.id);
    if (!result.ok) return;
    if (removing.id === thisDevice) setThisDevice(null);
    setRemoving(null);
    notify(t("notifications:push.removed"));
    devices.reload();
  };

  const deviceName = (device: PushDevice | null) =>
    describeUserAgent(device?.user_agent) ?? t("notifications:push.unknown_device");

  const renderSwitch = () => {
    if (support === "ios-install") {
      return <Alert tone="info" title={t("notifications:push.ios_title")}>{t("notifications:push.ios_install")}</Alert>;
    }
    if (support === "unsupported") {
      return <Alert tone="info" title={t("notifications:push.unsupported_title")}>{t("notifications:push.unsupported")}</Alert>;
    }
    if (permission === "denied") {
      return <Alert tone="error" title={t("notifications:push.denied_title")}>{t("notifications:push.denied")}</Alert>;
    }
    if (status.loading && !status.data) {
      return <Spinner size={18} label={t("auth:common.loading")}/>;
    }
    if (!vapidKey) {
      return <Alert tone="info">{t("notifications:push.unavailable")}</Alert>;
    }
    if (thisDevice) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <BellRinging size={18}/> {t("notifications:push.enabled")}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void disable()} disabled={removeDevice.pending}>
            {removeDevice.pending ? <Spinner size={14}/> : <BellSlash size={14}/>} {t("notifications:push.disable")}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-start gap-3">
        <Button size="sm" onClick={() => void enable()} disabled={busy}>
          {busy ? <Spinner size={14}/> : <BellRinging size={16}/>} {t("notifications:push.enable")}
        </Button>
        {notice && (
          <Alert tone={notice === "failed" ? "error" : "info"}>{t(`notifications:push.${notice}`)}</Alert>
        )}
      </div>
    );
  };

  const rows = list ?? [];

  return (
    <Panel
      title={t("notifications:push.title")}
      description={t("notifications:push.description")}
      action={
        <span className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={devices.reload}>
            <ArrowClockwise size={14}/> {t("auth:common.refresh")}
          </Button>
          {rows.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void sendTest()} disabled={test.pending}>
              {test.pending ? <Spinner size={14}/> : <PaperPlaneTilt size={14}/>} {t("notifications:push.test")}
            </Button>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        {renderSwitch()}

        <div>
          <h3 className="mb-3 text-sm font-medium text-neutral-300">{t("notifications:push.devices_title")}</h3>
          <PanelState
            loading={devices.loading && !devices.data}
            error={devices.error}
            empty={rows.length === 0}
            emptyLabel={t("notifications:push.devices_empty")}
            onRetry={devices.reload}
          >
            <ul className="flex flex-col divide-y divide-neutral-800">
              {rows.map((device) => (
                <li key={device.id} className="flex flex-wrap items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <DeviceMobile size={20} className="shrink-0 text-neutral-500"/>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-text">
                      {deviceName(device)}
                      {device.id === thisDevice && (
                        <Badge variant="accent" size="sm">{t("notifications:push.this_device")}</Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {[
                        t("notifications:push.registered_on", {value: formatDate(device.created_at, language)}),
                        device.last_used_at
                          ? t("notifications:push.last_used", {value: formatRelative(device.last_used_at, language)})
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(device)}>
                    <Trash size={14}/> {t("notifications:push.remove")}
                  </Button>
                </li>
              ))}
            </ul>
          </PanelState>
        </div>
      </div>

      <ConfirmDialog
        open={removing !== null}
        title={t("notifications:push.remove_title")}
        body={t("notifications:push.remove_body", {device: deviceName(removing)})}
        confirmLabel={t("notifications:push.remove")}
        pending={removeDevice.pending}
        error={removeDevice.error}
        onClose={() => {
          removeDevice.reset();
          setRemoving(null);
        }}
        onConfirm={() => void confirmRemove()}
      />
    </Panel>
  );
};
