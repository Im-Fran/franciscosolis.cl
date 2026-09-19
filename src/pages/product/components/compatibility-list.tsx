import {useTranslation} from "react-i18next";
import {
  Cpu,
  Desktop,
  DeviceMobile,
  HardDrives,
  Package,
  PuzzlePiece,
  Stack,
} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import type {CompatibilityEntry} from "@/lib/marketplace/types.ts";

/** One icon per kind. `other` is the escape hatch and reads as a plain entry. */
const KIND_ICONS: Record<string, Icon> = {
  os: Desktop,
  runtime: Stack,
  platform: DeviceMobile,
  dependency: PuzzlePiece,
  hardware: HardDrives,
  architecture: Cpu,
  other: Package,
};

/**
 * What a release runs on.
 *
 * Grouped by kind rather than listed flat, because the list answers several different questions —
 * "will it run on my machine", "do I need Java" — and a reader is only ever asking one of them.
 * Within a kind the service's own order is kept: it is a position an editor set, and re-sorting it
 * alphabetically would throw away the one thing that says which entry matters most.
 *
 * An optional entry is drawn as a qualifier on the row rather than as a row of its own. "PostgreSQL
 * 14+ (optional)" is one fact; splitting it into a second list called "optional" makes the reader
 * assemble it.
 */
export const CompatibilityList = ({
  entries,
  className,
  compact = false,
}: {
  entries: CompatibilityEntry[];
  className?: string;
  /** The sidebar variant: no headings, one line per entry, for a narrow column. */
  compact?: boolean;
}) => {
  const {t} = useTranslation(["product"]);

  if (entries.length === 0) return null;

  /* Insertion order is the service's order, and `Map` keeps it — so do the groups. */
  const groups = new Map<string, CompatibilityEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.kind);
    if (bucket) bucket.push(entry);
    else groups.set(entry.kind, [entry]);
  }

  if (compact) {
    return (
      <ul className={cn("flex flex-col gap-1.5", className)}>
        {entries.map((entry) => (
          <CompatibilityRow key={entry.id} entry={entry} compact/>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {[...groups].map(([kind, rows]) => (
        <section key={kind}>
          <h3 className="text-[12px] tracking-wide text-neutral-500 uppercase">
            {t(`product:compatibility.kinds.${kind}`, {defaultValue: kind})}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {rows.map((entry) => (
              <CompatibilityRow key={entry.id} entry={entry}/>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

const CompatibilityRow = ({entry, compact = false}: {entry: CompatibilityEntry; compact?: boolean}) => {
  const {t} = useTranslation(["product"]);
  const KindIcon = KIND_ICONS[entry.kind] ?? Package;
  const constraint = entry.constraint?.trim();

  return (
    <li className="flex items-baseline gap-2 text-sm text-neutral-300">
      <KindIcon size={compact ? 13 : 15} className="shrink-0 translate-y-0.5 text-neutral-500"/>
      <span className="min-w-0">
        <span className="text-text">{entry.name}</span>
        {constraint && <span className="ml-1.5 font-mono text-[13px] text-neutral-400">{constraint}</span>}
        {entry.optional && (
          <span className="ml-1.5 text-[12px] text-neutral-500">{t("product:compatibility.optional")}</span>
        )}
      </span>
    </li>
  );
};
