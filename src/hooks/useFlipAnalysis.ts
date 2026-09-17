import { useCallback, useEffect, useRef, useState } from "react";
import { configService } from "../services/configService";
import {
  applyFetchOutcome,
  fetchRowAnalysis,
  pendingRow,
} from "../services/rowAnalysis";
import {
  loadTradingConfig,
  type BuyingRegion,
  type TradingConfig,
} from "../services/tradingConfig";
import type { Character, DisplayRow, FlipRow, TrackedItem } from "../types";
import { useGeneration } from "./useGeneration";

interface LoadedConfig extends TradingConfig {
  items: TrackedItem[];
}

const rowKey = (region: string, item: TrackedItem): string => {
  return `${region}::${item.itemId}`;
};

export const useFlipAnalysis = () => {
  const [allCharacterNames, setAllCharacterNames] = useState<string[]>([]);
  const [currentCharacterName, setCurrentCharacterName] = useState<
    string | null
  >(null);
  const [buyingRegions, setBuyingRegions] = useState<BuyingRegion[]>([]);
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [sellWorld, setSellWorld] = useState("");
  const [rows, setRows] = useState<Record<string, FlipRow>>({});
  const [refreshingKeys, setRefreshingKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number | null>(
    null,
  );
  const [staleWarningThresholdMs, setStaleWarningThresholdMs] = useState<
    number | null
  >(null);

  // Identifies the current fetch-cycle "lifetime" (one per Current Character) — see
  // useGeneration's docs for why a superseded run (e.g. React StrictMode's dev-mode
  // mount/cleanup/remount, or switching the Current Character mid-fetch) can't come back to life.
  const generationTracker = useGeneration();
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const configRef = useRef<LoadedConfig | null>(null);
  const currentCharacterRef = useRef<Character | null>(null);

  const runRow = useCallback(
    async (
      item: TrackedItem,
      region: string,
      generation: number,
      isRetry = false,
    ) => {
      const config = configRef.current;
      const currentCharacter = currentCharacterRef.current;
      if (!config || !currentCharacter) return;

      const key = rowKey(region, item);

      setRefreshingKeys((prev) => new Set(prev).add(key));
      const outcome = await fetchRowAnalysis(
        item,
        region,
        currentCharacter,
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
        () => runRow(item, region, generation, isFreshFailure),
        delay,
      );
    },
    [generationTracker],
  );

  // Loads static config once and seeds the Current Character from the Default Character.
  // Doesn't depend on which character is currently selected.
  useEffect(() => {
    let cancelled = false;

    Promise.all([configService.getTrackedItems(), loadTradingConfig()]).then(
      ([trackedItems, tradingConfig]) => {
        if (cancelled) return;

        configRef.current = { items: trackedItems, ...tradingConfig };

        setItems(trackedItems);
        setAllCharacterNames(
          tradingConfig.characters.map((character) => character.name),
        );
        setBuyingRegions(tradingConfig.buyingRegions);
        setRefreshIntervalMs(tradingConfig.params.refreshIntervalMs);
        setStaleWarningThresholdMs(
          tradingConfig.params.staleWarningThresholdMs,
        );
        setCurrentCharacterName(tradingConfig.defaultCharacterName);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // (Re)runs the fetch cycle for every row whenever the Current Character changes —
  // including the very first time it's set, once config has loaded.
  useEffect(() => {
    const config = configRef.current;
    if (currentCharacterName === null || !config) return;

    const currentCharacter = config.characters.find(
      (character) => character.name === currentCharacterName,
    );
    if (!currentCharacter) return; // Nothing we can do without a character to sell through — leave everything as-is rather than guess.

    const generation = generationTracker.start();
    currentCharacterRef.current = currentCharacter;
    setSellWorld(currentCharacter.homeWorld);

    const rowDefs = config.buyingRegions.flatMap((buyingRegion) =>
      config.items.map((item) => ({ item, region: buyingRegion.region })),
    );

    const placeholderRows: Record<string, FlipRow> = {};
    rowDefs.forEach(({ item, region }) => {
      placeholderRows[rowKey(region, item)] = pendingRow(item);
    });
    setRows(placeholderRows);

    rowDefs.forEach(({ item, region }) => runRow(item, region, generation));

    return () => {
      generationTracker.cancel();
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, [currentCharacterName, runRow, generationTracker]);

  const rowsByRegion: Record<string, DisplayRow[]> = {};
  buyingRegions.forEach((buyingRegion) => {
    rowsByRegion[buyingRegion.region] = items.map((item) => {
      const key = rowKey(buyingRegion.region, item);
      return {
        row: rows[key] ?? pendingRow(item),
        isRefreshing: refreshingKeys.has(key),
      };
    });
  });

  return {
    buyingRegions,
    allCharacterNames,
    currentCharacterName,
    setCurrentCharacterName,
    sellWorld,
    rowsByRegion,
    lastUpdated,
    refreshIntervalMs,
    staleWarningThresholdMs,
  };
};
