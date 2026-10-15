import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {formatBytes, formatDuration, formatPercent} from "@/lib/custom-apps/format.ts";
import {cn} from "@/lib/utils.ts";
import {LineChart} from "@/pages/custom-apps/components/charts/line-chart.tsx";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The ranges worth asking for. The service keeps thirty days of raw samples, so that is the far end. */
const RANGES = [
  {key: "1h", ms: HOUR},
  {key: "6h", ms: 6 * HOUR},
  {key: "24h", ms: DAY},
  {key: "7d", ms: 7 * DAY},
  {key: "30d", ms: 30 * DAY},
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/**
 * A little short of the full thirty days. The service refuses a `from` older than its retention,
 * and "now" here and there are a request apart, so asking for exactly thirty days would be refused
 * by however long the request took to arrive.
 */
const RETENTION_MARGIN = 5 * 60_000;

/**
 * An installation's telemetry over time: CPU, memory and network, each on a chart of its own.
 *
 * Three charts rather than one with three lines, because they are three different units — two
 * percentages and a byte count — and a shared axis would have to lie about one of them. The window
 * is computed when the request is made, so the refresh button moves it to "now".
 */
export const InstallationMetrics = ({installationId}: {installationId: string}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const [range, setRange] = useState<RangeKey>("24h");
  const language = i18n.language;
  const span = RANGES.find((entry) => entry.key === range)?.ms ?? DAY;

  const metrics = useResource(
    useCallback(
      (signal: AbortSignal) => {
        const to = Date.now();
        const from = to - Math.min(span, 30 * DAY - RETENTION_MARGIN);
        return customAppsApi.installations.metrics(
          installationId,
          {from: new Date(from).toISOString(), to: new Date(to).toISOString()},
          signal,
        );
      },
      [installationId, span],
    ),
  );

  const points = useMemo(() => metrics.data?.points ?? [], [metrics.data]);
  const times = useMemo(() => points.map((point) => new Date(point.t).getTime()), [points]);

  const formats = useMemo(() => {
    const short = span <= DAY;
    const axis = new Intl.DateTimeFormat(language, short ? {hour: "2-digit", minute: "2-digit"} : {day: "numeric", month: "short"});
    const full = new Intl.DateTimeFormat(language, {dateStyle: "medium", timeStyle: "short"});
    return {x: (time: number) => axis.format(time), time: (time: number) => full.format(time)};
  }, [language, span]);

  const percent = (value: number) => formatPercent(value, language) ?? "";
  const bytes = (value: number) => formatBytes(value, language) ?? "";
  const hasGpu = points.some((point) => point.gpu_percent !== null);
  const bucket = metrics.data?.bucket_seconds;

  return (
    <Panel
      title={t("custom_apps:metrics.title")}
      description={bucket ? t("custom_apps:metrics.bucket", {bucket: formatDuration(bucket)}) : t("custom_apps:metrics.description")}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("custom_apps:metrics.range")} className="flex rounded-[var(--radius-md)] border border-neutral-800 p-0.5">
            {RANGES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={range === entry.key}
                onClick={() => setRange(entry.key)}
                className={cn(
                  "cursor-pointer rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px] tabular-nums transition-colors",
                  range === entry.key ? "bg-accent-900/60 text-accent-200" : "text-neutral-400 hover:text-text",
                )}
              >
                {t(`custom_apps:metrics.ranges.${entry.key}`)}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={metrics.reload}
            disabled={metrics.loading}
            aria-label={t("admin:common.refresh")}
          >
            <ArrowClockwise size={14} className={metrics.loading ? "animate-spin" : undefined} />
          </Button>
        </div>
      }
    >
      <PanelState loading={metrics.loading && !metrics.data} error={metrics.data ? null : metrics.error} onRetry={metrics.reload} ns="admin">
        <div className={cn("grid gap-8 xl:grid-cols-2", metrics.loading && "opacity-60 transition-opacity")}>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm text-neutral-300">{hasGpu ? t("custom_apps:metrics.cpu_gpu") : t("custom_apps:metrics.cpu")}</h3>
            <LineChart
              times={times}
              series={[
                {key: "cpu", label: t("custom_apps:snapshot.cpu"), values: points.map((point) => point.cpu_percent), tone: "primary"},
                ...(hasGpu
                  ? [{key: "gpu", label: t("custom_apps:snapshot.gpu"), values: points.map((point) => point.gpu_percent), tone: "secondary" as const}]
                  : []),
              ]}
              yMax={100}
              formatY={percent}
              formatX={formats.x}
              formatTime={formats.time}
              label={t("custom_apps:metrics.cpu")}
              emptyLabel={t("custom_apps:metrics.empty")}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm text-neutral-300">{t("custom_apps:metrics.memory")}</h3>
            <LineChart
              times={times}
              series={[
                {
                  key: "memory",
                  label: t("custom_apps:snapshot.memory"),
                  values: points.map((point) => point.memory_percent),
                  tone: "primary",
                },
              ]}
              yMax={100}
              formatY={percent}
              formatX={formats.x}
              formatTime={formats.time}
              label={t("custom_apps:metrics.memory")}
              emptyLabel={t("custom_apps:metrics.empty")}
            />
          </section>

          <section className="flex flex-col gap-2 xl:col-span-2">
            <h3 className="text-sm text-neutral-300">
              {t("custom_apps:metrics.network", {bucket: bucket ? formatDuration(bucket) : "—"})}
            </h3>
            <LineChart
              times={times}
              series={[
                {key: "rx", label: t("custom_apps:metrics.received"), values: points.map((point) => point.net_rx_bytes), tone: "primary"},
                {key: "tx", label: t("custom_apps:metrics.sent"), values: points.map((point) => point.net_tx_bytes), tone: "secondary"},
              ]}
              yStep={1024}
              formatY={bytes}
              formatX={formats.x}
              formatTime={formats.time}
              label={t("custom_apps:metrics.network", {bucket: bucket ? formatDuration(bucket) : "—"})}
              emptyLabel={t("custom_apps:metrics.empty")}
            />
          </section>
        </div>
      </PanelState>
    </Panel>
  );
};
