import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { buildItemIconUrl } from "../api/universalis";
import { itemService } from "../services/itemService";
import type { ItemSummary } from "../types";
import { Tooltip } from "./Tooltip";

/** The item's icon, what kind of thing it is, and what the game says about it. */
const ItemSummaryContent = ({
  itemId,
  summary,
  note,
}: {
  itemId: number;
  summary: ItemSummary | undefined;
  note: ReactNode;
}) => {
  // Not every item has an icon in the set, and one that doesn't is better left out than broken.
  const [hasIcon, setHasIcon] = useState(true);
  return (
    <span className="item-summary">
      {hasIcon && (
        <img
          className="item-summary-icon"
          src={buildItemIconUrl(itemId)}
          alt=""
          onError={() => setHasIcon(false)}
        />
      )}
      <span>
        {summary?.type !== undefined && (
          <span className="item-summary-type">{summary.type}</span>
        )}
        {summary?.description !== undefined && summary.description !== "" && (
          <span className="item-summary-description">
            {summary.description}
          </span>
        )}
        {note !== undefined && (
          <span className="item-summary-note">{note}</span>
        )}
      </span>
    </span>
  );
};

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
  const { data: summary } = useQuery({
    queryKey: ["itemSummary", itemId],
    queryFn: () =>
      itemService
        .getItemSummaries([itemId])
        // Nothing known about it is a result too, rather than something to keep asking for.
        .then((summaries) => summaries.get(itemId) ?? null),
    enabled: isOpened,
    staleTime: Infinity,
  });
  const open = () => setIsOpened(true);

  return (
    <Tooltip
      text={
        isOpened ? (
          <ItemSummaryContent
            itemId={itemId}
            summary={summary ?? undefined}
            note={note}
          />
        ) : null
      }
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
