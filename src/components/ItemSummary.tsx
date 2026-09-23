import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { buildItemIconUrl } from "../api/universalis";
import { itemService } from "../services/itemService";

/**
 * An item's icon, what kind of thing it is, and what the game says about it.
 *
 * Looks the item up as it mounts, so a page of items only fetches the ones
 * actually shown: callers render this once the tooltip or row it's in has been
 * opened, rather than for every item at once.
 */
export const ItemSummary = ({
  itemId,
  note,
}: {
  itemId: number;
  /** Anything else worth saying about the item, such as what following its name does. */
  note?: ReactNode;
}) => {
  const { data: summary } = useQuery({
    queryKey: ["itemSummary", itemId],
    queryFn: () =>
      itemService
        .getItemSummaries([itemId])
        // Nothing known about it is a result too, rather than something to keep asking for.
        .then((summaries) => summaries.get(itemId) ?? null),
    staleTime: Infinity,
  });
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
