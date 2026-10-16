import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {CrashGroupsPanel} from "@/pages/custom-apps/components/crashes/crash-groups-panel.tsx";
import {useAppInstallations} from "@/pages/custom-apps/components/use-app-installations.ts";
import {LogsPanel} from "@/pages/custom-apps/components/logs/logs-panel.tsx";
import {ModuleGate} from "@/pages/custom-apps/components/module-gate.tsx";

/**
 * What went wrong across the fleet: crash groups when the app reports crashes, and every device's
 * log when it reports logs. Either module is enough to open the tab; each panel needs its own.
 */
export const AppDiagnostics = () => {
  const {app} = useApp();
  const modules = app.modules ?? [];
  const installations = useAppInstallations(app.id);

  return (
    <ModuleGate modules={["crashes", "logs"]}>
      <div className="flex flex-col gap-6">
        {modules.includes("crashes") && <CrashGroupsPanel appId={app.id} />}
        {modules.includes("logs") && (
          <LogsPanel scope={{kind: "app", appId: app.id, installations: installations.data?.data ?? []}} />
        )}
      </div>
    </ModuleGate>
  );
};
