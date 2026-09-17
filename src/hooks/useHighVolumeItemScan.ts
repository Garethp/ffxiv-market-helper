import { useCallback, useState } from "react";
import {
  BULK_SALE_VELOCITY_BATCH_SIZE,
  fetchMarketableItemIds,
  fetchSaleVelocityBatch,
  type ItemSaleVelocity,
} from "../api/universalis";
import { chunk } from "../utils/chunk";
import { withOneRetry } from "../utils/withOneRetry";
import { useGeneration } from "./useGeneration";

export interface ScannedItem extends ItemSaleVelocity {
  totalSaleVelocity: number;
}

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
  | { state: "error"; message: string };

/**
 * Scans every marketable item on a given world or data center and reports
 * its recent sale velocity, so items worth adding to the tracked list can be
 * spotted by how much they actually trade. A one-shot operation — there's no
 * auto-refresh here, unlike the flip table.
 */
export const useHighVolumeItemScan = () => {
  const [status, setStatus] = useState<ScanStatus>({ state: "idle" });
  const [results, setResults] = useState<ScannedItem[]>([]);
  const generationTracker = useGeneration();

  const startScan = useCallback(
    async (
      worldOrDataCenter: string,
      entriesPerItem: number,
      statsWithinMs: number,
    ) => {
      const generation = generationTracker.start();
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
        withOneRetry(() =>
          fetchSaleVelocityBatch(worldOrDataCenter, batch, {
            entries: entriesPerItem,
            statsWithinMs,
          }),
        );

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
            if (generationTracker.isCurrent(generation)) {
              pendingResults.push(
                ...batchResults.map((item) => ({
                  ...item,
                  totalSaleVelocity: item.nqSaleVelocity + item.hqSaleVelocity,
                })),
              );
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
      }
    },
    [generationTracker],
  );

  return { status, results, startScan };
};
