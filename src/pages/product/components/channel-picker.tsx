import {useTranslation} from "react-i18next";
import {cn} from "@/lib/utils.ts";
import {ALL_CHANNELS, RELEASE_CHANNELS, type ChannelCounts} from "@/lib/marketplace/types.ts";

/**
 * Which line of releases the feed is showing.
 *
 * The stable line is the default and reads as "Releases" rather than as a filter, because for most
 * visitors it is not one — it is the changelog. The other lines are offered beside it, each with how
 * many published releases it holds, so a product that has never shipped a nightly does not offer a
 * tab that leads to an empty list.
 *
 * The choice lives in the query string rather than in component state: somebody linking a colleague
 * to "the beta changelog" is the normal case, and a picker that cannot be linked to is a worse
 * version of the navigation it stands in for. Same reasoning as the tabs themselves.
 */
export const ChannelPicker = ({
  value,
  counts,
  onChange,
  className,
}: {
  value: string;
  counts: ChannelCounts | undefined;
  onChange: (channel: string) => void;
  className?: string;
}) => {
  const {t} = useTranslation(["product"]);

  /*
   * A line with nothing published on it is left out entirely. Counts are absent while the sidebar
   * is still loading, and the safe reading of "unknown" is to offer the line: a picker that
   * flickers options in is worse than one that occasionally offers an empty list.
   */
  const available = RELEASE_CHANNELS.filter((channel) => (counts ? (counts[channel] ?? 0) > 0 : true));

  /* Nothing to choose between: one line, or none at all. The picker would be furniture. */
  if (available.length <= 1) return null;

  const options = [...available, ALL_CHANNELS];

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      role="group"
      aria-label={t("product:channels.picker_label")}
    >
      {options.map((channel) => {
        const active = channel === value;
        const count = channel === ALL_CHANNELS ? undefined : counts?.[channel];

        return (
          <button
            key={channel}
            type="button"
            onClick={() => onChange(channel)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] transition",
              active
                ? "bg-[var(--page-accent,var(--color-accent))] text-bg"
                : "text-neutral-400 hover:bg-surface hover:text-text",
            )}
          >
            {t(`product:channels.${channel}`, {defaultValue: channel})}
            {count !== undefined && (
              <span className={cn("text-[11px]", active ? "text-bg/70" : "text-neutral-500")}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
