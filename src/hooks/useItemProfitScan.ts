import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchItem } from "../api/xivapi";
import { UNTRACKED_ITEM_TARGET_QUANTITY } from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, DisplayRow, PricedItem } from "../types";
import { profitRow, rowMarketDataQuery } from "./profitRowQuery";

/**
 * Prices a single arbitrary item the same way the tracked items page prices tracked
 * items — across every buying region, selling through the Current Character — but
 * on demand and without adding it to the tracked list. Meant for checking
 * whether an item (e.g. one spotted on the high-volume-items scan) is worth
 * tracking permanently.
 *
 * Market data is fetched when the page opens and again whenever the Current
 * Character's home world changes, since that's the world being sold on.
 * Changing the quality, target quantity or sell price ceiling only
 * recalculates from the data already fetched.
 */
export const useItemProfitScan = (
  itemId: number,
  config: TradingConfig,
  currentCharacter: Character | null,
) => {
  const [hq, setHq] = useState(false);
  const [targetQuantity, setTargetQuantity] = useState(
    UNTRACKED_ITEM_TARGET_QUANTITY,
  );
  const [sellPriceCeiling, setSellPriceCeiling] = useState<number | undefined>(
    undefined,
  );

  // Details that can't be fetched just leave the item called by its ID.
  const { data: itemDetails = null } = useQuery({
    queryKey: ["itemDetails", itemId],
    queryFn: ({ signal }) => fetchItem(itemId, { signal }),
    // Items only change with game patches.
    staleTime: Infinity,
  });

  const marketDataQueries = useQueries({
    queries: config.buyingRegions.map(({ region }) =>
      rowMarketDataQuery(itemId, region, currentCharacter, config),
    ),
  });

  const item: PricedItem = {
    itemId,
    name: itemDetails?.name ?? `Item #${itemId}`,
    hq,
    stackSize: 1,
    targetQuantity,
    sellPriceCeiling,
  };
  const rowsByRegion: Record<string, DisplayRow[]> = {};
  if (currentCharacter) {
    config.buyingRegions.forEach(({ region }, i) => {
      const query = marketDataQueries[i];
      rowsByRegion[region] = [
        {
          row: profitRow(query, item, currentCharacter, config),
          isRefreshing: query.isFetching,
        },
      ];
    });
  }

  return {
    itemDetails,
    hq,
    setHq,
    targetQuantity,
    setTargetQuantity,
    sellPriceCeiling,
    setSellPriceCeiling,
    rowsByRegion,
  };
};
