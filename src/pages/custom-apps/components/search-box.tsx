import {MagnifyingGlass} from "@phosphor-icons/react";
import {HelpButton} from "@/components/ui/help.tsx";
import type {FieldHelp} from "@/components/ui/help.tsx";
import {Input} from "@/components/ui/input.tsx";
import {cn} from "@/lib/utils.ts";

/**
 * The search field every list in the panel opens with. The service does the matching. With `help`,
 * an info button follows the field and explains what the search looks at.
 */
export const SearchBox = ({
  value,
  onChange,
  placeholder,
  className,
  help,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  help?: FieldHelp;
}) => {
  const field = (
    <div className={cn("relative min-w-[12rem] flex-1", !help && className)}>
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

  if (!help) return field;
  return (
    <div className={cn("flex min-w-[12rem] flex-1 items-center gap-1", className)}>
      {field}
      <HelpButton label={placeholder} help={help} />
    </div>
  );
};
