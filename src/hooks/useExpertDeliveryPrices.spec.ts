// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RegionListing } from "../api/universalis";

vi.mock("../api/universalis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/universalis")>()),
  fetchRegionListings: vi.fn(),
}));

import { fetchRegionListings } from "../api/universalis";
import { withQueryClient } from "../testing/withQueryClient";
import { useExpertDeliveryPrices } from "./useExpertDeliveryPrices";

const mockedFetchRegionListings = vi.mocked(fetchRegionListings);

/** A promise whose resolution is controlled from outside. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const listings = (
  entries: [itemId: number, pricePerUnit: number, worldName: string][],
) =>
  new Map<number, RegionListing[]>(
    entries.map(([itemId, pricePerUnit, worldName]) => [
      itemId,
      [{ pricePerUnit, worldName }],
    ]),
  );

const renderPrices = (itemIds: number[], region = "Europe") =>
  renderHook(() => useExpertDeliveryPrices(itemIds, region), {
    wrapper: withQueryClient(),
  });

afterEach(() => {
  vi.resetAllMocks();
});

describe("useExpertDeliveryPrices", () => {
  it("should price each item by its listings in the region", async () => {
    const swordListings = [
      { pricePerUnit: 100, worldName: "Zodiark" },
      { pricePerUnit: 120, worldName: "Omega" },
    ];
    mockedFetchRegionListings.mockResolvedValue(
      new Map([
        [1, swordListings],
        [2, [{ pricePerUnit: 50, worldName: "Cerberus" }]],
      ]),
    );

    const { result } = renderPrices([1, 2]);

    await waitFor(() =>
      expect(result.current).toEqual({
        1: { status: "listed", listings: swordListings },
        2: {
          status: "listed",
          listings: [{ pricePerUnit: 50, worldName: "Cerberus" }],
        },
      }),
    );
    expect(mockedFetchRegionListings).toHaveBeenCalledWith(
      "Europe",
      [1, 2],
      expect.anything(),
    );
  });

  it("should say an item listed nowhere in the region has no listings", async () => {
    mockedFetchRegionListings.mockResolvedValue(new Map());

    const { result } = renderPrices([1]);

    await waitFor(() =>
      expect(result.current).toEqual({ 1: { status: "unlisted" } }),
    );
  });

  it("should ask for the items in batches of 100, in the order given", async () => {
    mockedFetchRegionListings.mockResolvedValue(new Map());
    const itemIds = Array.from({ length: 250 }, (_, i) => 1000 - i);

    renderPrices(itemIds);

    await waitFor(() =>
      expect(mockedFetchRegionListings).toHaveBeenCalledTimes(3),
    );
    expect(
      mockedFetchRegionListings.mock.calls.map(([, batch]) => batch),
    ).toEqual([
      itemIds.slice(0, 100),
      itemIds.slice(100, 200),
      itemIds.slice(200),
    ]);
  });

  it("should give a batch's prices as soon as it comes back, without waiting for the rest", async () => {
    const secondBatch = deferred<Map<number, RegionListing[]>>();
    mockedFetchRegionListings.mockImplementation(async (_, batch) =>
      batch.includes(1) ? listings([[1, 100, "Zodiark"]]) : secondBatch.promise,
    );
    const itemIds = Array.from({ length: 101 }, (_, i) => i + 1);

    const { result } = renderPrices(itemIds);

    await waitFor(() => expect(result.current[1]?.status).toBe("listed"));
    expect(result.current[101]).toBeUndefined();

    secondBatch.resolve(listings([[101, 5, "Odin"]]));
    await waitFor(() => expect(result.current[101]?.status).toBe("listed"));
  });

  it("should say the prices couldn't be fetched for only the batch whose fetch failed", async () => {
    mockedFetchRegionListings.mockImplementation(async (_, batch) => {
      if (batch.includes(1)) throw new Error("Universalis is down");
      return listings([[101, 5, "Odin"]]);
    });
    const itemIds = Array.from({ length: 101 }, (_, i) => i + 1);

    const { result } = renderPrices(itemIds);

    await waitFor(() => expect(result.current[101]?.status).toBe("listed"));
    await waitFor(() =>
      expect(result.current[1]).toEqual({ status: "failed" }),
    );
    expect(result.current[100]).toEqual({ status: "failed" });
  });
});
