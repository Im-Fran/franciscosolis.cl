import {MagnifyingGlass} from "@phosphor-icons/react";
import {Input} from "@/components/ui/input.tsx";
import {cn} from "@/lib/utils.ts";

/** The search field every list in the panel opens with. The service does the matching. */
export const SearchBox = ({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) => (
  <div className={cn("relative min-w-[12rem] flex-1", className)}>
    <MagnifyingGlass
      size={16}
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600"
    />
    <Input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="pl-9"
    />
  </div>
);
