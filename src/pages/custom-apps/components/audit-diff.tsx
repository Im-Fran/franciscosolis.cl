import {useTranslation} from "react-i18next";
import {cn} from "@/lib/utils.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A value as one readable line: strings bare, everything else as JSON, absence as a dash. */
const show = (value: unknown) =>
  value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value, null, 1).replace(/\n\s*/g, " ");

/**
 * What a write changed, field by field.
 *
 * The service records `{ before, after }` in an entry's metadata for the writes that changed a
 * record. Laid side by side with the changed fields marked, that answers "what did this do" without
 * reading two JSON blobs against each other; whatever else the metadata carries is printed below as
 * it came, because an audit log is evidence and nothing in it should be hidden by the viewer.
 */
export const AuditDiff = ({metadata}: {metadata: Record<string, unknown>}) => {
  const {t} = useTranslation("custom_apps");
  const before = isRecord(metadata.before) ? metadata.before : null;
  const after = isRecord(metadata.after) ? metadata.after : null;
  const {before: _before, after: _after, ...rest} = metadata;
  const extra = Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : null;

  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  const changed = (key: string) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]);
  /* The changed fields first: they are why the entry exists. */
  const ordered = [...keys.filter(changed), ...keys.filter((key) => !changed(key))];

  return (
    <div className="flex flex-col gap-5">
      {(before || after) && (
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[32rem] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-neutral-800 text-[11px] tracking-wide text-neutral-500 uppercase">
                <th scope="col" className="py-2 pr-3 font-medium">{t("audit.field")}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{t("audit.before")}</th>
                <th scope="col" className="py-2 font-medium">{t("audit.after")}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((key) => {
                const different = changed(key);
                return (
                  <tr key={key} className={cn("border-b border-neutral-800/60 align-top last:border-0", !different && "text-neutral-500")}>
                    <th scope="row" className="py-2 pr-3 font-mono font-normal whitespace-nowrap">
                      {different && <span className="mr-1.5 text-amber-300" aria-label={t("audit.changed")}>●</span>}
                      {key}
                    </th>
                    <td className={cn("py-2 pr-3 font-mono break-all", different && "text-red-300/90 line-through decoration-red-400/40")}>
                      {show(before?.[key])}
                    </td>
                    <td className={cn("py-2 font-mono break-all", different && "text-emerald-300")}>{show(after?.[key])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {extra && (
        <div className="flex flex-col gap-2">
          {(before || after) && <p className="text-[12px] text-neutral-500">{t("audit.other_metadata")}</p>}
          <pre className="max-h-72 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-300">
            {extra}
          </pre>
        </div>
      )}
    </div>
  );
};
