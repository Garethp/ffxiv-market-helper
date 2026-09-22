import { useQueries } from "@tanstack/react-query";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, DisplayRow } from "../types";
import { profitRow, rowMarketDataQuery } from "./profitRowQuery";

/**
 * Prices every tracked item through every buying region, selling through the
 * Current Character, and keeps each row refreshing on its own. A row whose
 * fetch fails is retried once after a short delay; if that fails too, it
 * keeps showing its last good data until a later refresh succeeds.
 */
export const useTrackedItemsAnalysis = (
  config: TradingConfig,
  currentCharacter: Character,
) => {
  const { buyingRegions, trackedItems, params } = config;
  const rowDefs = buyingRegions.flatMap(({ region }) =>
    trackedItems.map((item) => ({ region, item })),
  );

  const queries = useQueries({
    queries: rowDefs.map(({ region, item }) => ({
      ...rowMarketDataQuery(item.itemId, region, currentCharacter, config),
      refetchInterval: params.refreshIntervalMs,
      retry: 1,
      retryDelay: params.retryDelayMs,
    })),
  });

  const rowsByRegion: Record<string, DisplayRow[]> = Object.fromEntries(
    buyingRegions.map(({ region }) => [region, []]),
  );
  rowDefs.forEach(({ region, item }, i) => {
    const query = queries[i];
    rowsByRegion[region].push({
      row: profitRow(query, item, currentCharacter, config),
      isRefreshing: query.isFetching,
    });
  });

  const lastSuccessAt = Math.max(0, ...queries.map((q) => q.dataUpdatedAt));
  const lastUpdated = lastSuccessAt > 0 ? new Date(lastSuccessAt) : null;

  return { rowsByRegion, lastUpdated };
};
