// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/universalis", () => ({
  BULK_SALE_VELOCITY_BATCH_SIZE: 20,
  fetchMarketableItemIds: vi.fn(),
  fetchSaleVelocityBatch: vi.fn(),
}));
vi.mock("../services/itemService", () => ({
  itemService: { getItemNames: vi.fn() },
}));
vi.mock("../services/scanResultsService", () => ({
  scanResultsService: { getLatestScan: vi.fn(), saveScan: vi.fn() },
}));

import {
  fetchMarketableItemIds,
  fetchSaleVelocityBatch,
} from "../api/universalis";
import { itemService } from "../services/itemService";
import {
  scanResultsService,
  type CompletedScan,
} from "../services/scanResultsService";
import { useHighVolumeItemScan } from "./useHighVolumeItemScan";

const mockedFetchMarketableItemIds = vi.mocked(fetchMarketableItemIds);
const mockedFetchSaleVelocityBatch = vi.mocked(fetchSaleVelocityBatch);
const mockedGetLatestScan = vi.mocked(scanResultsService.getLatestScan);
const mockedSaveScan = vi.mocked(scanResultsService.saveScan);
const mockedGetItemNames = vi.mocked(itemService.getItemNames);

/** Names every item after its ID. */
const nameAfterIds = async (itemIds: number[]) =>
  new Map(itemIds.map((itemId) => [itemId, `Item ${itemId}`]));

const previousScan: CompletedScan = {
  worldOrDataCenter: "Chaos",
  completedAt: Date.parse("2026-09-17T06:00:00Z"),
  items: [{ itemId: 7, nqSaleVelocity: 40, hqSaleVelocity: 2 }],
};

/** A promise whose resolution is controlled from outside, to pin down batch-completion ordering. */
const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("useHighVolumeItemScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLatestScan.mockResolvedValue(undefined);
    mockedSaveScan.mockResolvedValue();
    mockedGetItemNames.mockImplementation(nameAfterIds);
  });

  it("should show results live at the start of a scan, then only periodically once there are enough to make every update costly", async () => {
    // 50 batches (1,000 items) to reach the early-feedback threshold, plus 10 more to exercise
    // batched flushing afterward — 60 batches of 20 items, 1,200 items total.
    const totalBatches = 60;
    const itemIds = Array.from({ length: totalBatches * 20 }, (_, i) => i + 1);
    mockedFetchMarketableItemIds.mockResolvedValue(itemIds);

    const batchDeferreds = Array.from({ length: totalBatches }, () =>
      createDeferred<void>(),
    );
    let callIndex = 0;
    mockedFetchSaleVelocityBatch.mockImplementation(async (_world, batch) => {
      await batchDeferreds[callIndex++].promise;
      return batch.map((itemId) => ({
        itemId,
        nqSaleVelocity: 1,
        hqSaleVelocity: 0,
      }));
    });

    const { result } = renderHook(() => useHighVolumeItemScan("Chaos"));

    await act(async () => {
      result.current.startScan(10, 86_400_000);
    });
    await waitFor(() =>
      expect(mockedFetchSaleVelocityBatch).toHaveBeenCalledTimes(totalBatches),
    );

    // Ramping up (fewer than 1,000 items flushed so far): each batch flushes on its own.
    await act(async () => {
      batchDeferreds[0].resolve();
    });
    await waitFor(() => expect(result.current.results).toHaveLength(20));
    await act(async () => {
      batchDeferreds[1].resolve();
    });
    await waitFor(() => expect(result.current.results).toHaveLength(40));

    // Resolve the rest of the ramp-up phase (batches 2-49) to reach exactly 1,000 flushed items.
    await act(async () => {
      batchDeferreds.slice(2, 50).forEach(({ resolve }) => resolve());
    });
    await waitFor(() => expect(result.current.results).toHaveLength(1000));

    // Past the threshold: 9 more completed batches (180 items) are held back, not flushed one at a time.
    await act(async () => {
      batchDeferreds.slice(50, 59).forEach(({ resolve }) => resolve());
    });
    expect(result.current.results).toHaveLength(1000);

    // The 10th batch past the threshold crosses the flush-every-10 boundary.
    await act(async () => {
      batchDeferreds[59].resolve();
    });
    await waitFor(() => expect(result.current.results).toHaveLength(1200));
    expect(result.current.status.state).toBe("done");
  });

  describe("completed scans", () => {
    it("should show the world's latest completed scan when first opened", async () => {
      mockedGetLatestScan.mockResolvedValue(previousScan);

      const { result } = renderHook(() => useHighVolumeItemScan("Chaos"));

      await waitFor(() =>
        expect(result.current.status).toEqual({
          state: "previous",
          completedAt: previousScan.completedAt,
        }),
      );
      expect(mockedGetLatestScan).toHaveBeenCalledWith("Chaos");
      expect(result.current.results).toEqual([
        {
          itemId: 7,
          name: "Item 7",
          nqSaleVelocity: 40,
          hqSaleVelocity: 2,
          totalSaleVelocity: 42,
        },
      ]);
    });

    it("should switch to the latest completed scan of a newly selected world, showing nothing if it has none", async () => {
      mockedGetLatestScan.mockImplementation(async (worldOrDataCenter) =>
        worldOrDataCenter === "Chaos" ? previousScan : undefined,
      );

      const { result, rerender } = renderHook(
        ({ world }) => useHighVolumeItemScan(world),
        { initialProps: { world: "Chaos" } },
      );
      await waitFor(() => expect(result.current.results).toHaveLength(1));

      rerender({ world: "Omega" });
      await waitFor(() =>
        expect(mockedGetLatestScan).toHaveBeenCalledWith("Omega"),
      );
      expect(result.current.status.state).toBe("idle");
      expect(result.current.results).toEqual([]);
    });

    it("should clear the latest completed scan from view as soon as a new scan starts, but only replace it once the new scan completes", async () => {
      mockedGetLatestScan.mockResolvedValue(previousScan);
      const itemIdsLookup = createDeferred<number[]>();
      mockedFetchMarketableItemIds.mockReturnValue(itemIdsLookup.promise);
      mockedFetchSaleVelocityBatch.mockImplementation(async (_world, batch) =>
        batch.map((itemId) => ({
          itemId,
          nqSaleVelocity: 5,
          hqSaleVelocity: 1,
        })),
      );

      const { result } = renderHook(() => useHighVolumeItemScan("Chaos"));
      await waitFor(() => expect(result.current.status.state).toBe("previous"));

      await act(async () => {
        result.current.startScan(10, 86_400_000);
      });
      expect(result.current.results).toEqual([]);
      expect(mockedSaveScan).not.toHaveBeenCalled();

      await act(async () => {
        itemIdsLookup.resolve([1, 2]);
      });
      await waitFor(() => expect(result.current.status.state).toBe("done"));
      expect(mockedSaveScan).toHaveBeenCalledWith({
        worldOrDataCenter: "Chaos",
        completedAt: expect.any(Number),
        items: [
          { itemId: 1, nqSaleVelocity: 5, hqSaleVelocity: 1 },
          { itemId: 2, nqSaleVelocity: 5, hqSaleVelocity: 1 },
        ],
      });
    });

    it("should not let a completed scan that finishes loading late replace a scan already under way", async () => {
      const latestScanLookup = createDeferred<CompletedScan | undefined>();
      mockedGetLatestScan.mockReturnValue(latestScanLookup.promise);
      mockedFetchMarketableItemIds.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useHighVolumeItemScan("Chaos"));
      await act(async () => {
        result.current.startScan(10, 86_400_000);
      });
      await act(async () => {
        latestScanLookup.resolve(previousScan);
      });

      expect(result.current.status.state).toBe("running");
      expect(result.current.results).toEqual([]);
    });

    it("should still show a scan's results when saving them fails", async () => {
      mockedFetchMarketableItemIds.mockResolvedValue([1, 2, 3]);
      mockedFetchSaleVelocityBatch.mockImplementation(async (_world, batch) =>
        batch.map((itemId) => ({
          itemId,
          nqSaleVelocity: 5,
          hqSaleVelocity: 1,
        })),
      );
      mockedSaveScan.mockRejectedValue(new Error("QuotaExceededError"));

      const { result } = renderHook(() => useHighVolumeItemScan("Chaos"));
      await act(async () => {
        result.current.startScan(10, 86_400_000);
      });

      await waitFor(() => expect(result.current.status.state).toBe("done"));
      expect(result.current.results).toHaveLength(3);
    });
  });

  describe("naming items", () => {
    const buildVelocity = (itemId: number) => ({
      itemId,
      nqSaleVelocity: 1,
      hqSaleVelocity: 0,
    });

    it("should name each batch's items as the batch comes in", async () => {
      mockedFetchMarketableItemIds.mockResolvedValue(
        Array.from({ length: 21 }, (_, i) => i + 1),
      );
      const secondBatch = createDeferred<void>();
      mockedFetchSaleVelocityBatch.mockImplementation(async (_, batch) => {
        if (batch.includes(21)) await secondBatch.promise;
        return batch.map(buildVelocity);
      });
      const { result } = renderHook(() => useHighVolumeItemScan("Chaos"));

      await act(async () => {
        result.current.startScan(10, 86_400_000);
      });

      await waitFor(() => expect(result.current.results).toHaveLength(20));
      expect(result.current.results[0].name).toBe("Item 1");
      expect(mockedGetItemNames).toHaveBeenCalledWith(
        Array.from({ length: 20 }, (_, i) => i + 1),
      );

      secondBatch.resolve();
      await waitFor(() => expect(result.current.results).toHaveLength(21));
      expect(result.current.results[20].name).toBe("Item 21");
      expect(mockedGetItemNames).toHaveBeenLastCalledWith([21]);
    });

    it("should still show a batch's items, without names, when their names can't be looked up", async () => {
      mockedFetchMarketableItemIds.mockResolvedValue([1]);
      mockedFetchSaleVelocityBatch.mockResolvedValue([buildVelocity(1)]);
      mockedGetItemNames.mockRejectedValue(new Error("XIVAPI is down"));
      const { result } = renderHook(() => useHighVolumeItemScan("Chaos"));

      await act(async () => {
        result.current.startScan(10, 86_400_000);
      });

      await waitFor(() => expect(result.current.status.state).toBe("done"));
      expect(result.current.results).toEqual([
        { ...buildVelocity(1), name: undefined, totalSaleVelocity: 1 },
      ]);
    });
  });

  describe("abandoning a scan", () => {
    /** Starts a scan whose batches never finish, and returns the signal each batch was given. */
    const startNeverEndingScan = async () => {
      mockedFetchMarketableItemIds.mockResolvedValue([1, 2]);
      mockedFetchSaleVelocityBatch.mockReturnValue(new Promise(() => {}));
      const hook = renderHook(({ world }) => useHighVolumeItemScan(world), {
        initialProps: { world: "Chaos" },
      });
      await act(async () => {
        hook.result.current.startScan(10, 86_400_000);
      });
      await waitFor(() =>
        expect(mockedFetchSaleVelocityBatch).toHaveBeenCalled(),
      );
      const signal = mockedFetchSaleVelocityBatch.mock.calls[0][2].signal!;
      return { ...hook, signal };
    };

    it("should cancel its remaining requests when the world changes", async () => {
      const { rerender, signal } = await startNeverEndingScan();
      expect(signal.aborted).toBe(false);

      rerender({ world: "Omega" });

      expect(signal.aborted).toBe(true);
    });
  });
});
