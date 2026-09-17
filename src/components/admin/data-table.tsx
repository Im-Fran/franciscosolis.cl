import type {ReactNode} from "react";
import {cn} from "@/lib/utils.ts";

export type Column<T> = {
  /** Stable identity of the column; also the React key of its cells. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Applied to the header cell and every body cell, e.g. to pin a column's width. */
  className?: string;
  /** Hides the column below `lg`, for the ones a narrow screen can do without. */
  hideBelowLg?: boolean;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Wraps the whole row in a link-like affordance; the row still has real focusable cells inside. */
  onRowClick?: (row: T) => void;
  /** Rendered ahead of the first column of every row — the drag handle of a sortable list. */
  leading?: (row: T) => ReactNode;
  caption?: string;
  className?: string;
};

/**
 * The list shape every administration screen uses. A real `<table>` rather than a grid of `<div>`s, so the
 * header stays associated with its cells for a screen reader, and it scrolls sideways on a narrow
 * screen instead of squeezing the columns into unreadable slivers.
 */
export const DataTable = <T,>({
  columns,
  rows,
  rowKey,
  onRowClick,
  leading,
  caption,
  className,
}: DataTableProps<T>) => (
  <div className={cn("-mx-6 overflow-x-auto px-6", className)}>
    <table className="w-full min-w-[38rem] border-collapse text-left">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr className="border-b border-neutral-800">
          {leading && <th scope="col" className="w-9 py-2.5"><span className="sr-only">{caption}</span></th>}
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={cn(
                "py-2.5 pr-4 text-[12px] font-medium tracking-wide text-neutral-500 uppercase",
                column.hideBelowLg && "hidden lg:table-cell",
                column.className,
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "border-b border-neutral-800/70 last:border-0",
              onRowClick && "cursor-pointer transition-colors hover:bg-neutral-800/30",
            )}
          >
            {leading && <td className="py-3 align-middle">{leading(row)}</td>}
            {columns.map((column) => (
              <td
                key={column.key}
                className={cn(
                  "py-3 pr-4 align-middle text-[13px] text-neutral-300",
                  column.hideBelowLg && "hidden lg:table-cell",
                  column.className,
                )}
              >
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
