import {useTranslation} from "react-i18next";
import {cn} from "@/lib/utils.ts";
import {STABLE_CHANNEL} from "@/lib/marketplace/types.ts";

/**
 * The line a release is on, as a label.
 *
 * The stable channel is deliberately **not** drawn: a release with no badge is the stable one, and
 * badging every entry on a product that never ships a nightly would add a column of noise saying
 * "normal". The badge exists to mark the exception.
 *
 * The colours go the way the risk does — a nightly reads as the loudest thing in the list, because
 * it is the one somebody could take by accident.
 */
const CHANNEL_TONES: Record<string, string> = {
  nightly: "bg-red-500/15 text-red-300 ring-red-500/30",
  beta: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  rc: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
};

export const ChannelBadge = ({
  channel,
  className,
  force = false,
}: {
  channel: string;
  className?: string;
  /** Draws the stable badge too, for a place where every entry has to be labelled explicitly. */
  force?: boolean;
}) => {
  const {t} = useTranslation(["product"]);

  if (channel === STABLE_CHANNEL && !force) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ring-1 ring-inset",
        CHANNEL_TONES[channel] ?? "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30",
        className,
      )}
    >
      {/* An unknown channel prints its own key rather than vanishing: a new line the service grew
          should be visible as itself, not as a release with no label at all. */}
      {t(`product:channels.${channel}`, {defaultValue: channel})}
    </span>
  );
};
