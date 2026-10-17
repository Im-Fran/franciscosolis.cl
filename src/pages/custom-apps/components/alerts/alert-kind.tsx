import {ArrowCounterClockwise, Bug, ClockCountdown, Cpu, Memory, Scroll, UserPlus, Warning} from "@phosphor-icons/react";
import type {Icon, IconProps} from "@phosphor-icons/react";
import type {AlertKind} from "@/lib/custom-apps/types.ts";

const ICONS: Record<AlertKind, Icon> = {
  installation_offline: ClockCountdown,
  cpu_high: Cpu,
  memory_high: Memory,
  crash_spike: Bug,
  error_log_spike: Scroll,
  enrollment_spike: UserPlus,
  release_rollbacks: ArrowCounterClockwise,
};

/** One glyph per alert kind, so an inbox of mixed alerts can be scanned by what they are about. */
export const AlertKindIcon = ({kind, ...props}: IconProps & {kind: string}) => {
  const Glyph = ICONS[kind as AlertKind] ?? Warning;
  return <Glyph aria-hidden {...props} />;
};
