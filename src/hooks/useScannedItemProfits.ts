import { useEffect, useMemo, useState } from "react";
import {
  analyzeRow,
  fetchRowMarketData,
  pendingRow,
  UNTRACKED_ITEM_TARGET_QUANTITY,
  type RowMarketData,
} from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, ProfitRow, TrackedItem } from "../types";
import { useGeneration } from "./useGeneration";

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

/** How fetching one buying region's market data for an item turned out. */
type RegionMarketData =
  | { status: "loaded"; marketData: RowMarketData }
  | { status: "failed"; message: string };

type ItemMarketData =
  | { status: "loading" }
  | {
      status: "settled";
      /** Every buying region, at least one of which loaded. */
      byRegion: Record<string, RegionMarketData>;
      /** The character it was fetched for, which it has to be analyzed against. */
      sellingCharacter: Character;
      fetchedAt: number;
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
  data: Extract<ItemMarketData, { status: "settled" }>,
): TrackedItem => {
  // Every region's fetch includes the same sell world's data, and at least one of them loaded.
  const { sell } = Object.values(data.byRegion).flatMap((regionData) =>
    regionData.status === "loaded" ? [regionData.marketData] : [],
  )[0];
  return {
    itemId,
    name,
    hq: sell.hqSaleVelocity > sell.nqSaleVelocity,
    stackSize: 1,
    targetQuantity: UNTRACKED_ITEM_TARGET_QUANTITY,
  };
};

/** Prices the item bought via one region. */
const regionRow = (
  item: TrackedItem,
  regionData: RegionMarketData,
  sellingCharacter: Character,
  fetchedAt: number,
  config: TradingConfig,
): ProfitRow => {
  if (regionData.status === "failed") {
    return {
      ...pendingRow(item),
      lastAttemptFailed: true,
      lastErrorMessage: regionData.message,
    };
  }
  return {
    item,
    analysis: analyzeRow(
      regionData.marketData,
      item,
      sellingCharacter,
      config.ownRetainers,
      config.params,
    ),
    lastSuccessAt: fetchedAt,
    lastAttemptFailed: false,
    lastErrorMessage: null,
  };
};

/**
 * Prices each of the given items the same way the item page does — across
 * every buying region, selling through the Current Character — once per set
 * of items, without refreshing afterward.
 */
export const useScannedItemProfits = (
  itemIds: number[],
  itemNames: Record<number, string>,
  config: TradingConfig,
  currentCharacter: Character | null,
): Record<number, ScannedItemProfit> => {
  const [marketDataByItem, setMarketDataByItem] = useState<
    Record<number, ItemMarketData>
  >({});
  const generationTracker = useGeneration();
  // Fetching is keyed on which items there are, not on the array holding them, so a caller
  // building a fresh array with the same items each render doesn't restart it.
  const itemIdsKey = itemIds.join(",");

  useEffect(() => {
    const generation = generationTracker.start();
    if (!currentCharacter || itemIds.length === 0) {
      setMarketDataByItem({});
      return;
    }
    const { buyingRegions, regions, params } = config;

    setMarketDataByItem(
      Object.fromEntries(
        itemIds.map((itemId) => [itemId, { status: "loading" }]),
      ),
    );
    itemIds.forEach(async (itemId) => {
      const byRegion: Record<string, RegionMarketData> = Object.fromEntries(
        await Promise.all(
          buyingRegions.map(async ({ region }) => {
            let result: RegionMarketData;
            try {
              const marketData = await fetchRowMarketData(
                itemId,
                region,
                currentCharacter,
                regions,
                params,
              );
              result = { status: "loaded", marketData };
            } catch (err) {
              result = {
                status: "failed",
                message: err instanceof Error ? err.message : "Unknown error",
              };
            }
            return [region, result] as const;
          }),
        ),
      );
      if (!generationTracker.isCurrent(generation)) return;

      const anyLoaded = Object.values(byRegion).some(
        (regionData) => regionData.status === "loaded",
      );
      setMarketDataByItem((prev) => {
        const next = { ...prev };
        if (anyLoaded) {
          next[itemId] = {
            status: "settled",
            byRegion,
            sellingCharacter: currentCharacter,
            fetchedAt: Date.now(),
          };
        } else {
          delete next[itemId];
        }
        return next;
      });
    });

    return () => generationTracker.cancel();
  }, [itemIdsKey, config, currentCharacter, generationTracker]);

  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(marketDataByItem).map(([id, data]) => {
          const itemId = Number(id);
          if (data.status === "loading") return [itemId, data];

          const item = untrackedItem(
            itemId,
            itemNames[itemId] ?? `#${itemId}`,
            data,
          );
          const profit: ScannedItemProfit = {
            status: "ready",
            rowByRegion: Object.fromEntries(
              Object.entries(data.byRegion).map(([region, regionData]) => [
                region,
                regionRow(
                  item,
                  regionData,
                  data.sellingCharacter,
                  data.fetchedAt,
                  config,
                ),
              ]),
            ),
          };
          return [itemId, profit];
        }),
      ),
    [marketDataByItem, itemNames, config],
  );
};
