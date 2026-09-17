import {useMemo} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {DragEndEvent} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {DotsSixVertical} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";

export type SortableListProps<T> = {
  items: T[];
  itemKey: (item: T) => string;
  /** Called with the whole list in its new order — never with a single moved item. */
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  disabled?: boolean;
  /** Names the list for assistive tech, e.g. "Projects, in display order". */
  label: string;
};

/**
 * A list whose order is the data.
 *
 * A pointer drag only starts after a few pixels of movement, so a click on a row's own controls
 * still behaves like a click; the keyboard sensor gives the same reordering to anyone who does not
 * drag at all. Reordering is local until the caller saves it — the API takes the whole new order in
 * one call, so committing on every drop would fire a write per nudge.
 */
export const SortableList = <T,>({
  items,
  itemKey,
  onReorder,
  renderItem,
  disabled,
  label,
}: SortableListProps<T>) => {
  const {t} = useTranslation();
  const ids = useMemo(() => items.map(itemKey), [items, itemKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  );

  const onDragEnd = ({active, over}: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul className="flex flex-col gap-2" aria-label={label}>
          {items.map((item, index) => (
            <SortableRow
              key={itemKey(item)}
              id={itemKey(item)}
              index={index}
              total={items.length}
              disabled={disabled}
              handleLabel={t("cms:reorder.handle", {position: index + 1, total: items.length})}
            >
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
};

type SortableRowProps = {
  id: string;
  index: number;
  total: number;
  disabled?: boolean;
  handleLabel: string;
  children: ReactNode;
};

const SortableRow = ({id, index, disabled, handleLabel, children}: SortableRowProps) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id, disabled});

  return (
    <li
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5",
        isDragging && "relative z-10 border-accent-600 shadow-[var(--shadow-sm)] opacity-95",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={handleLabel}
        className="shrink-0 cursor-grab touch-none rounded-[var(--radius-sm)] p-1 text-neutral-600 transition-colors hover:bg-neutral-800 hover:text-neutral-300 focus-visible:text-neutral-300 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={16}/>
      </button>

      <span className="w-6 shrink-0 text-right font-mono text-[11px] text-neutral-600">{index + 1}</span>

      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
};
