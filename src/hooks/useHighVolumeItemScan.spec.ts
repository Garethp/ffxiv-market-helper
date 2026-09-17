// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../api/universalis", () => ({
  BULK_SALE_VELOCITY_BATCH_SIZE: 20,
  fetchMarketableItemIds: vi.fn(),
  fetchSaleVelocityBatch: vi.fn(),
}));

import {
  fetchMarketableItemIds,
  fetchSaleVelocityBatch,
} from "../api/universalis";
import { useHighVolumeItemScan } from "./useHighVolumeItemScan";

const mockedFetchMarketableItemIds = vi.mocked(fetchMarketableItemIds);
const mockedFetchSaleVelocityBatch = vi.mocked(fetchSaleVelocityBatch);

/** A promise whose resolution is controlled from outside, to pin down batch-completion ordering. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("useHighVolumeItemScan", () => {
  it("should show results live at the start of a scan, then only periodically once there are enough to make every update costly", async () => {
    // 50 batches (1,000 items) to reach the early-feedback threshold, plus 10 more to exercise
    // batched flushing afterward — 60 batches of 20 items, 1,200 items total.
    const totalBatches = 60;
    const itemIds = Array.from({ length: totalBatches * 20 }, (_, i) => i + 1);
    mockedFetchMarketableItemIds.mockResolvedValue(itemIds);

    const batchDeferreds = Array.from({ length: totalBatches }, () =>
      deferred<void>(),
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

    const { result } = renderHook(() => useHighVolumeItemScan());

    await act(async () => {
      result.current.startScan("Chaos", 10, 86_400_000);
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
});
