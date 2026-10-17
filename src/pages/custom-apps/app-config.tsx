import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import type {ConfigDocument} from "@/lib/custom-apps/types.ts";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {ConfigEditor} from "@/pages/custom-apps/components/config/config-editor.tsx";
import {ConfigHistory} from "@/pages/custom-apps/components/config/config-history.tsx";
import {FlagsPanel} from "@/pages/custom-apps/components/config/flags-panel.tsx";
import {ModuleGate} from "@/pages/custom-apps/components/module-gate.tsx";

/**
 * What the app is told to be, without a release: its feature flags, and one versioned JSON document.
 * Devices pick both up on their next heartbeat, or at once over the live socket.
 *
 * The configuration is loaded here rather than in the editor because the history beside it needs
 * the current version too — to mark it, and to know when a save or a restore added a new one.
 */
export const AppConfig = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {app} = useApp();

  const record = useResource(useCallback((signal: AbortSignal) => customAppsApi.config.get(app.id, signal), [app.id]));
  const [config, setConfig] = useState<ConfigDocument | null>(null);
  useEffect(() => {
    if (record.data) setConfig(record.data);
  }, [record.data]);

  const current = config && (config.app_id ?? app.id) === app.id ? config : null;

  return (
    <ModuleGate modules={["config"]}>
      <div className="flex flex-col gap-6">
        <FlagsPanel appId={app.id} />

        {current ? (
          <>
            <ConfigEditor appId={app.id} config={current} onSaved={setConfig} onReload={record.reload} />
            <ConfigHistory appId={app.id} currentVersion={current.version} onRestored={setConfig} />
          </>
        ) : (
          <Panel title={t("custom_apps:config.title")}>
            <PanelState loading={record.loading} error={record.error} onRetry={record.reload} ns="admin">
              {null}
            </PanelState>
          </Panel>
        )}
      </div>
    </ModuleGate>
  );
};
