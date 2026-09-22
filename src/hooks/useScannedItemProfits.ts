import { useQueries, type QueryObserverResult } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  UNTRACKED_ITEM_TARGET_QUANTITY,
  type RowMarketData,
} from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, ProfitRow, PricedItem } from "../types";
import { profitRow, rowMarketDataQuery } from "./profitRowQuery";

/**
 * How far pricing a scanned item has got. An item that isn't being priced, or
 * that couldn't be priced through any buying region, has no entry at all —
 * either way there's no profit to show for it.
 */
export type ScannedItemProfit =
  | { status: "loading" }
  | {
      status: "ready";
      /** One row per buying region, keyed by region — including any whose fetch failed. */
      rowByRegion: Record<string, ProfitRow>;
    };

/**
 * The item as priced through every buying region. A scanned item isn't
 * tracked, so it has no quality or target quantity of its own: it's priced at
 * whichever quality sells more on the sell world — what an item gets used for
 * decides whether it's in demand as HQ, wherever it's bought — with ties going
 * to NQ.
 */
const untrackedItem = (
  itemId: number,
  name: string,
  { sell }: RowMarketData,
): PricedItem => ({
  itemId,
  name,
  hq: sell.hqSaleVelocity > sell.nqSaleVelocity,
  stackSize: 1,
  targetQuantity: UNTRACKED_ITEM_TARGET_QUANTITY,
});

/**
 * Prices each of the given items the same way the tracked items page prices
 * tracked items — across every buying region, selling through the Current
 * Character — but once per set of items, without refreshing afterward.
 */
export const useScannedItemProfits = (
  items: { itemId: number; name: string | null }[],
  config: TradingConfig,
  currentCharacter: Character,
): Record<number, ScannedItemProfit> => {
  const { buyingRegions } = config;
  // Keyed on which items there are, not on the array holding them, so a caller building a fresh
  // array with the same items each render doesn't make every profit get worked out again.
  const itemIdsKey = items.map((item) => item.itemId).join(",");
  const pricedItems = useMemo(() => items, [itemIdsKey]);

  // Only reruns when a query's result or one of its own inputs changes, and its result keeps the
  // same identity while nothing in it has changed — so a memoized table showing it doesn't
  // re-render along with everything else on the page.
  const combine = useCallback(
    (queries: QueryObserverResult<RowMarketData>[]) => {
      const profits: Record<number, ScannedItemProfit> = {};

      pricedItems.forEach(({ itemId, name }, i) => {
        const regionQueries = queries.slice(
          i * buyingRegions.length,
          (i + 1) * buyingRegions.length,
        );
        if (regionQueries.some((query) => query.isPending)) {
          profits[itemId] = { status: "loading" };
          return;
        }
        // Every region's fetch includes the same sell world's data, so any that loaded will do.
        const loaded = regionQueries.find(
          (query) => query.data !== undefined,
        )?.data;
        if (!loaded) return;

        const item = untrackedItem(itemId, name ?? `#${itemId}`, loaded);
        profits[itemId] = {
          status: "ready",
          rowByRegion: Object.fromEntries(
            buyingRegions.map(({ region }, r) => [
              region,
              profitRow(regionQueries[r], item, currentCharacter, config),
            ]),
          ),
        };
      });
      return profits;
    },
    [pricedItems, config, buyingRegions, currentCharacter],
  );

  return useQueries({
    queries: pricedItems.flatMap(({ itemId }) =>
      buyingRegions.map(({ region }) =>
        rowMarketDataQuery(itemId, region, currentCharacter, config),
      ),
    ),
    combine,
  });
};
