import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { itemService } from "../../services/itemService";
import type { ItemSearchResult } from "../../types";
import { ErrorMessage } from "../ErrorMessage";
import { ItemSummaryTooltip } from "../ItemSummaryTooltip";

/** How long typing has to pause before searching, so there isn't a search for every character typed. */
const TYPING_PAUSE_MS = 300;

/** The fewest characters worth searching for. Any fewer match too many items to be useful. */
const MIN_SEARCH_LENGTH = 2;

/** The value, once it's stopped changing for `delayMs`. */
const useSettledValue = <T,>(value: T, delayMs: number): T => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return settled;
};

/** How a search for `searchText` has gone: still going, failed, found nothing, or the items to pick from. */
const SearchOutcome = ({
  search,
  searchText,
  onPick,
}: {
  search: UseQueryResult<ItemSearchResult[]>;
  searchText: string;
  onPick: (item: ItemSearchResult) => void;
}) => {
  if (search.isPending) return <p className="muted">Searching…</p>;
  if (search.isError) {
    return (
      <ErrorMessage>Couldn't search for items. Try again shortly.</ErrorMessage>
    );
  }
  if (search.data.length === 0) {
    return <p className="muted">No items found for "{searchText}".</p>;
  }
  return (
    <ul className="item-search-results">
      {search.data.map((item) => (
        <li key={item.itemId}>
          <ItemSummaryTooltip itemId={item.itemId}>
            {(tooltipId) => (
              <button
                type="button"
                aria-describedby={tooltipId}
                onClick={() => onPick(item)}
              >
                {item.name}
              </button>
            )}
          </ItemSummaryTooltip>
        </li>
      ))}
    </ul>
  );
};

/** Finds an item that can be sold on the market board by part of its name, and passes on the one picked. */
export const ItemSearch = ({
  onPick,
}: {
  onPick: (item: ItemSearchResult) => void;
}) => {
  const [text, setText] = useState("");
  const searchText = useSettledValue(text.trim(), TYPING_PAUSE_MS);
  const canSearch = searchText.length >= MIN_SEARCH_LENGTH;

  // Each text is its own query, so a search for earlier text is cancelled once it's no longer wanted,
  // and its results are never shown in place of the latest ones.
  const search = useQuery({
    queryKey: ["itemSearch", searchText],
    queryFn: ({ signal }) => itemService.searchItems(searchText, { signal }),
    enabled: canSearch,
    // Items only change with game patches.
    staleTime: Infinity,
  });

  return (
    <div className="item-search">
      <label>
        Search for an item
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. cordial"
        />
      </label>
      {canSearch && (
        <SearchOutcome
          search={search}
          searchText={searchText}
          onPick={onPick}
        />
      )}
    </div>
  );
};
