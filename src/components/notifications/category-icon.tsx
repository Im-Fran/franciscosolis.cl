import {Bell, Lifebuoy, Storefront, UserCircle} from "@phosphor-icons/react";
import type {Icon, IconProps} from "@phosphor-icons/react";
import type {NotificationCategory} from "@/lib/notifications/types.ts";

const ICONS: Record<NotificationCategory, Icon> = {
  account: UserCircle,
  support: Lifebuoy,
  marketplace: Storefront,
};

/** One glyph per category, so a list of mixed notifications can be scanned by what they are about. */
export const CategoryIcon = ({category, ...props}: IconProps & {category: string}) => {
  const Glyph = ICONS[category as NotificationCategory] ?? Bell;
  return <Glyph aria-hidden {...props}/>;
};
