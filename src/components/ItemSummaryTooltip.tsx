import { useState, type ReactNode } from "react";
import { ItemSummary } from "./ItemSummary";
import { Tooltip } from "./Tooltip";

/**
 * Shows an item's icon, type and what the game says about it while it's
 * hovered or focused. Both are only looked up once the tooltip has first been
 * opened, since a page of these would otherwise fetch every item's icon and
 * details at once.
 *
 * Wraps the item's name, or whatever `children` builds around the tooltip's
 * ID — for a name that's already a link, say, which points at the tooltip
 * itself rather than being wrapped in something else focusable.
 */
export const ItemSummaryTooltip = ({
  itemId,
  name,
  note,
  children,
}: {
  itemId: number;
  /** Used when there's no `children` to build the name. */
  name?: string;
  /** Anything else worth saying about the name, such as what following it does. */
  note?: ReactNode;
  children?: (tooltipId: string) => ReactNode;
}) => {
  const [isOpened, setIsOpened] = useState(false);
  const open = () => setIsOpened(true);

  return (
    <Tooltip
      // Only built once opened, so the item is looked up then rather than on load.
      text={isOpened ? <ItemSummary itemId={itemId} note={note} /> : null}
    >
      {(tooltipId) => (
        <span onMouseEnter={open} onFocus={open}>
          {children?.(tooltipId) ?? (
            // Focusable, so the summary can be reached without a pointer.
            <span tabIndex={0} aria-describedby={tooltipId}>
              {name}
            </span>
          )}
        </span>
      )}
    </Tooltip>
  );
};
