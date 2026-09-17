import { useEffect, useMemo, useState } from "react";
import { fetchItemNames } from "../api/xivapi";
import {
  analyzeRow,
  fetchRowMarketData,
  pendingRow,
  UNTRACKED_ITEM_TARGET_QUANTITY,
  type RowMarketData,
} from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, DisplayRow, ProfitRow, TrackedItem } from "../types";
import { useGeneration } from "./useGeneration";

/** Where fetching one buying region's market data has got to. */
type RegionMarketData =
  | { status: "loading" }
  | {
      status: "loaded";
      marketData: RowMarketData;
      /** The character it was fetched for, which it has to be analyzed against. */
      sellingCharacter: Character;
      fetchedAt: number;
    }
  | { status: "failed"; message: string };

/**
 * Prices a single arbitrary item the same way the tracked items page prices tracked
 * items — across every buying region, selling through the Current Character — but
 * on demand and without adding it to the tracked list. Meant for checking
 * whether an item (e.g. one spotted on the high-volume-items scan) is worth
 * tracking permanently.
 *
 * Market data is fetched when the page opens and again whenever the Current
 * Character changes, since that changes the world being sold on. Changing
 * the quality, target quantity or sell price ceiling only recalculates from
 * the data already fetched.
 */
export const useItemProfitScan = (
  itemId: number,
  config: TradingConfig,
  currentCharacter: Character | null,
) => {
  const [itemName, setItemName] = useState<string | null>(null);
  const [hq, setHq] = useState(false);
  const [targetQuantity, setTargetQuantity] = useState(
    UNTRACKED_ITEM_TARGET_QUANTITY,
  );
  const [sellPriceCeiling, setSellPriceCeiling] = useState<number | undefined>(
    undefined,
  );
  const [marketDataByRegion, setMarketDataByRegion] = useState<
    Record<string, RegionMarketData>
  >({});
  const generationTracker = useGeneration();

  useEffect(() => {
    let cancelled = false;
    fetchItemNames([itemId])
      .then((names) => {
        if (!cancelled) setItemName(names.get(itemId) ?? null);
      })
      .catch(() => {
        // A missing name just falls back to showing the item ID.
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    if (!currentCharacter) return;
    const generation = generationTracker.start();
    const { buyingRegions, regions, params } = config;

    setMarketDataByRegion(
      Object.fromEntries(
        buyingRegions.map(({ region }) => [region, { status: "loading" }]),
      ),
    );
    buyingRegions.forEach(async ({ region }) => {
      let result: RegionMarketData;
      try {
        const marketData = await fetchRowMarketData(
          itemId,
          region,
          currentCharacter,
          regions,
          params,
        );
        result = {
          status: "loaded",
          marketData,
          sellingCharacter: currentCharacter,
          fetchedAt: Date.now(),
        };
      } catch (err) {
        result = {
          status: "failed",
          message: err instanceof Error ? err.message : "Unknown error",
        };
      }
      if (!generationTracker.isCurrent(generation)) return;
      setMarketDataByRegion((prev) => ({ ...prev, [region]: result }));
    });
  }, [itemId, config, currentCharacter, generationTracker]);

  const rowsByRegion = useMemo(() => {
    const item: TrackedItem = {
      itemId,
      name: itemName ?? `Item #${itemId}`,
      hq,
      stackSize: 1,
      targetQuantity,
      sellPriceCeiling,
    };
    const toRow = (regionData: RegionMarketData): ProfitRow => {
      switch (regionData.status) {
        case "loading":
          return pendingRow(item);
        case "loaded":
          return {
            item,
            analysis: analyzeRow(
              regionData.marketData,
              item,
              regionData.sellingCharacter,
              config.ownRetainers,
              config.params,
            ),
            lastSuccessAt: regionData.fetchedAt,
            lastAttemptFailed: false,
            lastErrorMessage: null,
          };
        case "failed":
          return {
            ...pendingRow(item),
            lastAttemptFailed: true,
            lastErrorMessage: regionData.message,
          };
      }
    };

    const rows: Record<string, DisplayRow[]> = {};
    Object.entries(marketDataByRegion).forEach(([region, regionData]) => {
      rows[region] = [
        {
          row: toRow(regionData),
          isRefreshing: regionData.status === "loading",
        },
      ];
    });
    return rows;
  }, [
    itemId,
    itemName,
    hq,
    targetQuantity,
    sellPriceCeiling,
    marketDataByRegion,
    config,
  ]);

  return {
    itemName,
    hq,
    setHq,
    targetQuantity,
    setTargetQuantity,
    sellPriceCeiling,
    setSellPriceCeiling,
    rowsByRegion,
  };
};
