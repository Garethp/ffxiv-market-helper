import { useCallback, useEffect, useRef, useState } from "react";
import {
  BULK_SALE_VELOCITY_BATCH_SIZE,
  fetchMarketableItemIds,
  fetchSaleVelocityBatch,
  type ItemSaleVelocity,
} from "../api/universalis";
import { itemService } from "../services/itemService";
import { scanResultsService } from "../services/scanResultsService";
import { chunk } from "../utils/chunk";
import { withOneRetry } from "../utils/withOneRetry";
import { useGeneration } from "./useGeneration";

export interface ScannedItem extends ItemSaleVelocity {
  /** Null when the item's name couldn't be found. */
  name: string | null;
  totalSaleVelocity: number;
}

/** The items with their names. Items are still worth showing when their names can't be looked up. */
const withNames = async (items: ItemSaleVelocity[]): Promise<ScannedItem[]> => {
  const names = await itemService
    .getItemNames(items.map((item) => item.itemId))
    .catch(() => new Map<number, string>());
  return items.map((item) => ({
    ...item,
    name: names.get(item.itemId) ?? null,
    totalSaleVelocity: item.nqSaleVelocity + item.hqSaleVelocity,
  }));
};

/**
 * How many completed network batches to accumulate before committing them to
 * `results` state, once EARLY_FEEDBACK_ITEM_THRESHOLD has been reached. A
 * full scan is ~850 network batches — appending to `results` on every single
 * one this late would mean copying an array approaching ~17,000 items ~850
 * times. Batching flushes trades a little liveliness for making that O(n)
 * copy ~10x rarer, while still updating often enough to feel live.
 *
 * The scanned-item count isn't subject to this — it's reported every batch —
 * because the table that displays `results` is memoized (see
 * ScannedItemsTable) and doesn't re-render just because this count does.
 */
const RESULTS_FLUSH_BATCH_COUNT = 10;

/**
 * Below this many flushed results, every batch flushes immediately instead
 * of waiting for RESULTS_FLUSH_BATCH_COUNT — copying an array this small is
 * cheap, and the start of a scan is when the fastest visual feedback matters
 * most.
 */
const EARLY_FEEDBACK_ITEM_THRESHOLD = 1000;

export type ScanStatus =
  | { state: "idle" }
  | { state: "running"; scannedItems: number; totalItems: number }
  | {
      state: "done";
      scannedItems: number;
      totalItems: number;
      failedBatchCount: number;
    }
  /** Showing a scan completed earlier, rather than one run since the page loaded. */
  | { state: "previous"; completedAt: number }
  | { state: "error"; message: string };

/**
 * Scans every marketable item on a given world or data center and reports
 * its recent sale velocity, so items worth adding to the tracked list can be
 * spotted by how much they actually trade. A one-shot operation — there's no
 * auto-refresh here, unlike the tracked items page.
 *
 * Shows the latest completed scan of the world or data center, if there's a
 * recent enough one, and switches to that of the new one whenever it
 * changes, abandoning any scan in progress. A new scan clears the completed
 * one from view straight away, but only replaces the saved scan once it
 * completes.
 */
export const useHighVolumeItemScan = (worldOrDataCenter: string) => {
  const [status, setStatus] = useState<ScanStatus>({ state: "idle" });
  const [results, setResults] = useState<ScannedItem[]>([]);
  const generationTracker = useGeneration();
  // The most recently started scan, so its remaining requests can be cancelled once it's abandoned.
  const scanControllerRef = useRef<AbortController | null>(null);

  // Switching world, or leaving the page, abandons any scan in progress.
  useEffect(() => {
    return () => scanControllerRef.current?.abort();
  }, [worldOrDataCenter]);

  useEffect(() => {
    const generation = generationTracker.start();
    setResults([]);
    setStatus({ state: "idle" });

    scanResultsService.getLatestScan(worldOrDataCenter).then(
      async (scan) => {
        if (scan === null) return;
        const items = await withNames(scan.items);
        // A scan started while this was loading takes precedence over it.
        if (!generationTracker.isCurrent(generation)) return;
        setResults(items);
        setStatus({ state: "previous", completedAt: scan.completedAt });
      },
      () => {
        // A saved scan that can't be read is no different from not having one.
      },
    );
  }, [generationTracker, worldOrDataCenter]);

  const startScan = useCallback(
    async (entriesPerItem: number, statsWithinMs: number) => {
      const generation = generationTracker.start();
      scanControllerRef.current?.abort();
      const scanController = new AbortController();
      scanControllerRef.current = scanController;
      const { signal } = scanController;
      setResults([]);
      setStatus({ state: "running", scannedItems: 0, totalItems: 0 });

      let itemIds: number[];
      try {
        itemIds = await fetchMarketableItemIds();
      } catch (err) {
        if (!generationTracker.isCurrent(generation)) return;
        setStatus({
          state: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
        return;
      }
      if (!generationTracker.isCurrent(generation)) return;

      const batches = chunk(itemIds, BULK_SALE_VELOCITY_BATCH_SIZE);
      let scannedItems = 0;
      let failedBatchCount = 0;
      setStatus({
        state: "running",
        scannedItems: 0,
        totalItems: itemIds.length,
      });

      // Some Universalis bulk requests fail transiently (e.g. a gateway timeout under load) even
      // at a batch size that normally clears it comfortably.
      const fetchBatchWithRetry = (batch: number[]) =>
        withOneRetry(
          () =>
            fetchSaleVelocityBatch(worldOrDataCenter, batch, {
              entries: entriesPerItem,
              statsWithinMs,
              signal,
            }),
          signal,
        );

      // Every result so far, for saving once the scan completes — `results` state can't be read from here.
      const allResults: ItemSaleVelocity[] = [];
      let pendingResults: ScannedItem[] = [];
      let batchesSincePendingFlush = 0;
      let flushedItemCount = 0;
      const flushPendingResults = () => {
        if (pendingResults.length === 0) return;
        const toFlush = pendingResults;
        pendingResults = [];
        batchesSincePendingFlush = 0;
        flushedItemCount += toFlush.length;
        setResults((prev) => [...prev, ...toFlush]);
      };

      await Promise.all(
        batches.map(async (batch) => {
          try {
            const batchResults = await fetchBatchWithRetry(batch);
            const namedResults = await withNames(batchResults);
            if (generationTracker.isCurrent(generation)) {
              allResults.push(...batchResults);
              pendingResults.push(...namedResults);
              batchesSincePendingFlush++;
              const stillRampingUp =
                flushedItemCount < EARLY_FEEDBACK_ITEM_THRESHOLD;
              if (
                stillRampingUp ||
                batchesSincePendingFlush >= RESULTS_FLUSH_BATCH_COUNT
              ) {
                flushPendingResults();
              }
            }
          } catch {
            failedBatchCount++;
          } finally {
            scannedItems += batch.length;
            if (generationTracker.isCurrent(generation)) {
              setStatus({
                state: "running",
                scannedItems,
                totalItems: itemIds.length,
              });
            }
          }
        }),
      );
      if (generationTracker.isCurrent(generation)) flushPendingResults();

      if (generationTracker.isCurrent(generation)) {
        setStatus({
          state: "done",
          scannedItems,
          totalItems: itemIds.length,
          failedBatchCount,
        });
        scanResultsService
          .saveScan({
            worldOrDataCenter,
            completedAt: Date.now(),
            items: allResults,
          })
          .catch(() => {
            // The results are already on screen. Failing to save them (e.g. storage full) only
            // means they won't be there next visit.
          });
      }
    },
    [generationTracker, worldOrDataCenter],
  );

  return { status, results, startScan };
};
