import { useCallback, useEffect, useRef, useState } from "react";
import { fetchItemNames } from "../api/xivapi";
import {
  applyFetchOutcome,
  fetchRowAnalysis,
  pendingRow,
} from "../services/rowAnalysis";
import {
  loadTradingConfig,
  type TradingConfig,
} from "../services/tradingConfig";
import type { DisplayRow, FlipRow, TrackedItem } from "../types";
import { useGeneration } from "./useGeneration";

/**
 * Prices a single arbitrary item the same way the flip table prices tracked
 * items — across every buying region, selling through the Current Character — but
 * on demand and without adding it to the tracked list. Meant for checking
 * whether an item (e.g. one spotted on the high-volume-items scan) is worth
 * tracking permanently.
 */
export const useItemProfitScan = (itemId: number) => {
  const [config, setConfig] = useState<TradingConfig | null>(null);
  const [itemName, setItemName] = useState<string | null>(null);
  const [currentCharacterName, setCurrentCharacterName] = useState<
    string | null
  >(null);
  const [hq, setHq] = useState(false);
  const [targetQuantity, setTargetQuantity] = useState(99);
  const [sellPriceCeiling, setSellPriceCeiling] = useState<number | undefined>(
    undefined,
  );
  const [rowsByRegion, setRowsByRegion] = useState<Record<string, FlipRow>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const generationTracker = useGeneration();
  const hasAutoScannedRef = useRef(false);
  // Tracks the latest resolved name so an in-flight scan (started before the name arrived) can
  // pick it up when it finishes, instead of writing back the stale placeholder it was called with.
  const itemNameRef = useRef(itemName);
  useEffect(() => {
    itemNameRef.current = itemName;
  }, [itemName]);

  useEffect(() => {
    let cancelled = false;
    loadTradingConfig().then((loaded) => {
      if (cancelled) return;
      setConfig(loaded);
      setCurrentCharacterName(loaded.defaultCharacterName);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const runScan = useCallback(async () => {
    if (!config || !currentCharacterName) return;
    const currentCharacter = config.characters.find(
      (character) => character.name === currentCharacterName,
    );
    if (!currentCharacter) return;

    const generation = generationTracker.start();
    setIsScanning(true);
    setHasScanned(true);

    const item: TrackedItem = {
      itemId,
      name: itemName ?? `Item #${itemId}`,
      hq,
      stackSize: 1,
      targetQuantity,
      sellPriceCeiling,
    };

    const placeholders: Record<string, FlipRow> = {};
    config.buyingRegions.forEach((buyingRegion) => {
      placeholders[buyingRegion.region] = pendingRow(item);
    });
    setRowsByRegion(placeholders);

    await Promise.all(
      config.buyingRegions.map(async (buyingRegion) => {
        const outcome = await fetchRowAnalysis(
          item,
          buyingRegion.region,
          currentCharacter,
          config.regions,
          config.ownRetainers,
          config.params,
        );
        if (!generationTracker.isCurrent(generation)) return;

        const resolvedItem = {
          ...item,
          name: itemNameRef.current ?? item.name,
        };
        setRowsByRegion((prev) => ({
          ...prev,
          [buyingRegion.region]: applyFetchOutcome(
            prev[buyingRegion.region],
            resolvedItem,
            outcome,
          ),
        }));
      }),
    );

    if (generationTracker.isCurrent(generation)) setIsScanning(false);
  }, [
    config,
    currentCharacterName,
    itemId,
    itemName,
    hq,
    targetQuantity,
    sellPriceCeiling,
    generationTracker,
  ]);

  // Scans automatically as soon as config and the Current Character are ready, using the default
  // inputs — checking several items back-to-back (e.g. from the high-volume-items list) shouldn't
  // need a click each time. Later input changes still require an explicit rescan.
  useEffect(() => {
    if (hasAutoScannedRef.current || !config || !currentCharacterName) return;
    hasAutoScannedRef.current = true;
    runScan();
  }, [config, currentCharacterName, runScan]);

  // The name lookup is a real network round-trip while config (all local) resolves almost
  // instantly, so the auto-scan above nearly always starts before the name arrives and bakes in
  // the "Item #id" fallback. Once the name does resolve, patch it into whatever rows already
  // exist rather than re-running the (identical) price fetch just to pick up a label.
  useEffect(() => {
    if (itemName === null) return;
    setRowsByRegion((prev) => {
      const next: Record<string, FlipRow> = {};
      let changed = false;
      Object.entries(prev).forEach(([region, row]) => {
        if (row.item.name === itemName) {
          next[region] = row;
        } else {
          changed = true;
          next[region] = { ...row, item: { ...row.item, name: itemName } };
        }
      });
      return changed ? next : prev;
    });
  }, [itemName]);

  const sellWorld =
    (currentCharacterName &&
      config?.characters.find(
        (character) => character.name === currentCharacterName,
      )?.homeWorld) ||
    "";

  const rowsByRegionDisplay: Record<string, DisplayRow[]> = {};
  Object.entries(rowsByRegion).forEach(([region, row]) => {
    rowsByRegionDisplay[region] = [{ row, isRefreshing: isScanning }];
  });

  return {
    itemName,
    allCharacterNames:
      config?.characters.map((character) => character.name) ?? [],
    currentCharacterName,
    setCurrentCharacterName,
    hq,
    setHq,
    targetQuantity,
    setTargetQuantity,
    sellPriceCeiling,
    setSellPriceCeiling,
    buyingRegions: config?.buyingRegions ?? [],
    rowsByRegion: rowsByRegionDisplay,
    sellWorld,
    isScanning,
    hasScanned,
    runScan,
  };
};
