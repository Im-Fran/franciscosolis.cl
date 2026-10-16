import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {BatteryHigh, Clock, Cpu, GraphicsCard, HardDrives, Lightning, Memory, WifiHigh} from "@phosphor-icons/react";
import {formatBytes, formatDuration, formatNumber, formatPercent} from "@/lib/custom-apps/format.ts";
import type {Snapshot} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";

/** A share of a total as a thin bar, so "how full" reads before the numbers do. */
const Meter = ({value}: {value: number | null}) =>
  value === null ? null : (
    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-neutral-800" aria-hidden="true">
      <span
        className={cn("block h-full rounded-full", value >= 90 ? "bg-red-400" : value >= 75 ? "bg-amber-400" : "bg-accent")}
        style={{width: `${Math.max(0, Math.min(100, value))}%`}}
      />
    </span>
  );

const Card = ({icon, label, value, detail, meter}: {icon: ReactNode; label: string; value: string | null; detail?: string | null; meter?: number | null}) => {
  const {t} = useTranslation("custom_apps");
  return (
    <div className="rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3">
      <p className="flex items-center gap-2 text-[12px] font-medium tracking-wide text-neutral-500 uppercase">
        <span aria-hidden="true">{icon}</span>
        {label}
      </p>
      <p className={cn("mt-1.5 text-lg tabular-nums", value === null ? "text-neutral-600" : "text-text")}>
        {value ?? t("snapshot.na")}
      </p>
      {detail && <p className="text-[12px] text-neutral-500 tabular-nums">{detail}</p>}
      <Meter value={meter ?? null} />
    </div>
  );
};

const share = (used: number | null | undefined, total: number | null | undefined) =>
  typeof used === "number" && typeof total === "number" && total > 0 ? (used / total) * 100 : null;

/**
 * The last heartbeat's snapshot, one card per reading.
 *
 * Every field is optional — a browser reports no battery and no disk, a kiosk no GPU — and an absent
 * one says "N/A" in its card rather than the card disappearing: a grid whose shape changes from one
 * device to the next is harder to scan than one with a few quiet cells.
 */
export const SnapshotCards = ({snapshot}: {snapshot: Snapshot | null}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const language = i18n.language;
  const s = snapshot ?? {};

  const memoryShare = share(s.memory_used_bytes, s.memory_total_bytes);
  const diskShare = share(s.disk_used_bytes, s.disk_total_bytes);
  const hasNetwork = typeof s.net_rx_bytes === "number" || typeof s.net_tx_bytes === "number";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card icon={<Cpu size={14} />} label={t("snapshot.cpu")} value={formatPercent(s.cpu_percent, language)} meter={s.cpu_percent} />
      <Card
        icon={<Memory size={14} />}
        label={t("snapshot.memory")}
        value={
          typeof s.memory_used_bytes === "number"
            ? typeof s.memory_total_bytes === "number"
              ? `${formatBytes(s.memory_used_bytes, language)} / ${formatBytes(s.memory_total_bytes, language)}`
              : formatBytes(s.memory_used_bytes, language)
            : null
        }
        detail={formatPercent(memoryShare, language)}
        meter={memoryShare}
      />
      <Card icon={<GraphicsCard size={14} />} label={t("snapshot.gpu")} value={formatPercent(s.gpu_percent, language)} meter={s.gpu_percent} />
      <Card
        icon={<HardDrives size={14} />}
        label={t("snapshot.disk")}
        value={
          typeof s.disk_used_bytes === "number"
            ? typeof s.disk_total_bytes === "number"
              ? `${formatBytes(s.disk_used_bytes, language)} / ${formatBytes(s.disk_total_bytes, language)}`
              : formatBytes(s.disk_used_bytes, language)
            : null
        }
        detail={formatPercent(diskShare, language)}
        meter={diskShare}
      />
      <Card
        icon={<WifiHigh size={14} />}
        label={t("snapshot.network")}
        value={
          hasNetwork
            ? `↓ ${formatBytes(s.net_rx_bytes, language) ?? t("snapshot.na")} · ↑ ${formatBytes(s.net_tx_bytes, language) ?? t("snapshot.na")}`
            : null
        }
        detail={hasNetwork ? t("snapshot.network_detail") : null}
      />
      <Card
        icon={<BatteryHigh size={14} />}
        label={t("snapshot.battery")}
        value={formatPercent(s.battery_percent, language)}
        detail={
          typeof s.battery_charging === "boolean" ? (s.battery_charging ? t("snapshot.charging") : t("snapshot.discharging")) : null
        }
        meter={s.battery_percent}
      />
      <Card
        icon={<Lightning size={14} />}
        label={t("snapshot.power")}
        value={typeof s.power_watts === "number" ? `${formatNumber(s.power_watts, language, 1)} W` : null}
      />
      <Card icon={<Clock size={14} />} label={t("snapshot.uptime")} value={formatDuration(s.uptime_seconds)} />
    </div>
  );
};
