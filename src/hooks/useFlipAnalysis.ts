import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyFetchOutcome,
  fetchRowAnalysis,
  pendingRow,
} from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, DisplayRow, FlipRow, TrackedItem } from "../types";
import { useGeneration } from "./useGeneration";

const rowKey = (region: string, item: TrackedItem): string => {
  return `${region}::${item.itemId}`;
};

export const useFlipAnalysis = (
  config: TradingConfig,
  currentCharacter: Character | null,
) => {
  const [rows, setRows] = useState<Record<string, FlipRow>>({});
  const [refreshingKeys, setRefreshingKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Identifies the current fetch-cycle "lifetime" (one per Current Character) — see
  // useGeneration's docs for why a superseded run (e.g. React StrictMode's dev-mode
  // mount/cleanup/remount, or switching the Current Character mid-fetch) can't come back to life.
  const generationTracker = useGeneration();
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const runRow = useCallback(
    async (
      item: TrackedItem,
      region: string,
      character: Character,
      generation: number,
      isRetry = false,
    ) => {
      const key = rowKey(region, item);

      setRefreshingKeys((prev) => new Set(prev).add(key));
      const outcome = await fetchRowAnalysis(
        item,
        region,
        character,
        config.regions,
        config.ownRetainers,
        config.params,
      );
      if (!generationTracker.isCurrent(generation)) return;

      setRows((prev) => ({
        ...prev,
        [key]: applyFetchOutcome(prev[key], item, outcome),
      }));
      if (outcome.success) setLastUpdated(new Date());
      setRefreshingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      // A fresh failure gets one quick retry; a retry that also fails (or any success) falls back to the normal cadence.
      const isFreshFailure = !outcome.success && !isRetry;
      const delay = isFreshFailure
        ? config.params.retryDelayMs
        : config.params.refreshIntervalMs;
      timersRef.current[key] = setTimeout(
        () => runRow(item, region, character, generation, isFreshFailure),
        delay,
      );
    },
    [config, generationTracker],
  );

  // (Re)runs the fetch cycle for every row whenever the Current Character changes.
  useEffect(() => {
    if (!currentCharacter) return; // Nothing we can do without a character to sell through — leave everything as-is rather than guess.

    const generation = generationTracker.start();
    const rowDefs = config.buyingRegions.flatMap((buyingRegion) =>
      config.trackedItems.map((item) => ({
        item,
        region: buyingRegion.region,
      })),
    );

    const placeholderRows: Record<string, FlipRow> = {};
    rowDefs.forEach(({ item, region }) => {
      placeholderRows[rowKey(region, item)] = pendingRow(item);
    });
    setRows(placeholderRows);

    rowDefs.forEach(({ item, region }) =>
      runRow(item, region, currentCharacter, generation),
    );

    return () => {
      generationTracker.cancel();
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, [config, currentCharacter, runRow, generationTracker]);

  const rowsByRegion: Record<string, DisplayRow[]> = {};
  config.buyingRegions.forEach((buyingRegion) => {
    rowsByRegion[buyingRegion.region] = config.trackedItems.map((item) => {
      const key = rowKey(buyingRegion.region, item);
      return {
        row: rows[key] ?? pendingRow(item),
        isRefreshing: refreshingKeys.has(key),
      };
    });
  });

  return { rowsByRegion, lastUpdated };
};
