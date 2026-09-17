// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UniversalisMarketData } from "../api/universalis";
import type { RowMarketData } from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, TradingParameters } from "../types";

vi.mock("../services/rowAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/rowAnalysis")>();
  return { ...actual, fetchRowMarketData: vi.fn() };
});

import { fetchRowMarketData } from "../services/rowAnalysis";
import { useScannedItemProfits } from "./useScannedItemProfits";

const mockedFetchRowMarketData = vi.mocked(fetchRowMarketData);

/** A promise whose resolution is controlled from outside, to pin down fetch-ordering races. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const alice: Character = { name: "Alice", homeWorld: "WorldA", retainers: [] };
const bob: Character = { name: "Bob", homeWorld: "WorldB", retainers: [] };

const config: TradingConfig = {
  trackedItems: [],
  characters: [alice, bob],
  regions: [],
  params: {
    buyTaxRate: 0,
    defaultSellTaxRate: 0,
    gapThresholdMultiplier: 1.1,
    saleSampleSize: 3,
    undercutListingThreshold: 5,
  } as TradingParameters,
  defaultCharacterName: "Alice",
  buyingRegions: [
    { region: "Europe", characters: [{ name: "Alice" }] },
    { region: "Japan", characters: [{ name: "Bob" }] },
  ],
  ownRetainers: [],
};

const sales = (pricePerUnit: number, hq: boolean) =>
  [1, 2, 3].map(() => ({ pricePerUnit, quantity: 1, timestamp: 0, hq }));

const listing = (pricePerUnit: number, hq: boolean) => ({
  pricePerUnit,
  quantity: 100,
  hq,
  retainerName: "Someone Else",
});

const marketData = (
  data: Partial<UniversalisMarketData>,
): UniversalisMarketData => ({
  itemID: 1,
  listings: [],
  recentHistory: [],
  nqSaleVelocity: 0,
  hqSaleVelocity: 0,
  ...data,
});

/**
 * Sells at 1,000 NQ / 2,000 HQ, with the given daily sale velocities, and
 * buys at the given NQ and HQ prices from a single data center.
 */
const regionMarketData = ({
  dataCenter,
  nqBuyPrice,
  hqBuyPrice,
  nqSaleVelocity = 10,
  hqSaleVelocity = 10,
}: {
  dataCenter: string;
  nqBuyPrice: number;
  hqBuyPrice: number;
  nqSaleVelocity?: number;
  hqSaleVelocity?: number;
}): RowMarketData => ({
  sell: marketData({
    recentHistory: [...sales(1000, false), ...sales(2000, true)],
    nqSaleVelocity,
    hqSaleVelocity,
  }),
  sellTaxRates: {},
  buy: [
    {
      dataCenter,
      data: marketData({
        listings: [listing(nqBuyPrice, false), listing(hqBuyPrice, true)],
      }),
    },
  ],
});

/** Answers each buying region's fetch with the market data given for it. */
const marketDataByRegion = (byRegion: Record<string, RowMarketData>) => {
  mockedFetchRowMarketData.mockImplementation(async (_itemId, region) => {
    const data = byRegion[region];
    if (!data) throw new Error(`No market data for ${region}`);
    return data;
  });
};

/** The item's row for one buying region, once it's been priced. */
const rowFor = (
  result: { current: ReturnType<typeof useScannedItemProfits> },
  itemId: number,
  region = "Europe",
) => {
  const profit = result.current[itemId];
  if (profit?.status !== "ready") throw new Error("Not priced yet");
  return profit.rowByRegion[region];
};

beforeEach(() => {
  vi.clearAllMocks();
  marketDataByRegion({
    Europe: regionMarketData({
      dataCenter: "Light",
      nqBuyPrice: 400,
      hqBuyPrice: 1900,
    }),
  });
});

describe("useScannedItemProfits", () => {
  describe("which items it prices", () => {
    it("should price nothing when there are no items to price", () => {
      const { result } = renderHook(() =>
        useScannedItemProfits([], {}, config, alice),
      );

      expect(result.current).toEqual({});
      expect(mockedFetchRowMarketData).not.toHaveBeenCalled();
    });

    it("should price nothing without a character to sell through", () => {
      const { result } = renderHook(() =>
        useScannedItemProfits([1], {}, config, null),
      );

      expect(result.current).toEqual({});
      expect(mockedFetchRowMarketData).not.toHaveBeenCalled();
    });

    it("should fetch every item across every buying region, selling through the given character", async () => {
      const itemIds = [1, 2];
      renderHook(() => useScannedItemProfits(itemIds, {}, config, alice));

      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(4),
      );
      expect(
        mockedFetchRowMarketData.mock.calls.map(
          ([itemId, region, character]) => [itemId, region, character],
        ),
      ).toEqual([
        [1, "Europe", alice],
        [1, "Japan", alice],
        [2, "Europe", alice],
        [2, "Japan", alice],
      ]);
    });

    it("should stop showing items that are no longer being priced", async () => {
      const { result, rerender } = renderHook(
        ({ itemIds }) => useScannedItemProfits(itemIds, {}, config, alice),
        { initialProps: { itemIds: [1] } },
      );
      await waitFor(() => rowFor(result, 1));

      rerender({ itemIds: [] });

      expect(result.current).toEqual({});
    });

    it("should not let a fetch for items that are no longer being priced come back and show them", async () => {
      const fetch = deferred<RowMarketData>();
      mockedFetchRowMarketData.mockReturnValue(fetch.promise);
      const { result, rerender } = renderHook(
        ({ itemIds }) => useScannedItemProfits(itemIds, {}, config, alice),
        { initialProps: { itemIds: [1] } },
      );
      await waitFor(() => expect(mockedFetchRowMarketData).toHaveBeenCalled());

      rerender({ itemIds: [] });
      await act(async () => {
        fetch.resolve(
          regionMarketData({
            dataCenter: "Light",
            nqBuyPrice: 400,
            hqBuyPrice: 1900,
          }),
        );
      });

      expect(result.current).toEqual({});
    });

    it("should fetch again for a newly selected character, since that changes the world it's sold on", async () => {
      const itemIds = [1];
      const { rerender } = renderHook(
        ({ character }) =>
          useScannedItemProfits(itemIds, {}, config, character),
        { initialProps: { character: alice } },
      );
      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(2),
      );

      rerender({ character: bob });

      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(4),
      );
      expect(mockedFetchRowMarketData.mock.calls[2][2]).toBe(bob);
    });
  });

  describe("when the same items are given again", () => {
    it("should not fetch them again", async () => {
      const { result, rerender } = renderHook(
        ({ itemIds }) => useScannedItemProfits(itemIds, {}, config, alice),
        { initialProps: { itemIds: [1] } },
      );
      await waitFor(() => rowFor(result, 1));

      rerender({ itemIds: [1] });

      expect(rowFor(result, 1)).toBeDefined();
      expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(2);
    });
  });

  describe("while an item is being priced", () => {
    it("should show it as loading", () => {
      mockedFetchRowMarketData.mockReturnValue(
        deferred<RowMarketData>().promise,
      );

      const { result } = renderHook(() =>
        useScannedItemProfits([1], {}, config, alice),
      );

      expect(result.current[1]).toEqual({ status: "loading" });
    });
  });

  describe("once an item is priced", () => {
    it("should price it through each buying region separately", async () => {
      marketDataByRegion({
        Europe: regionMarketData({
          dataCenter: "Light",
          nqBuyPrice: 400,
          hqBuyPrice: 1900,
        }),
        Japan: regionMarketData({
          dataCenter: "Elemental",
          nqBuyPrice: 100,
          hqBuyPrice: 1900,
        }),
      });

      const { result } = renderHook(() =>
        useScannedItemProfits([1], {}, config, alice),
      );

      await waitFor(() => rowFor(result, 1));
      expect(rowFor(result, 1, "Europe").analysis).toMatchObject({
        buyDataCenter: "Light",
        expectedProfitPerDay: 6000,
      });
      expect(rowFor(result, 1, "Japan").analysis).toMatchObject({
        buyDataCenter: "Elemental",
        expectedProfitPerDay: 9000,
      });
    });

    describe("choosing its quality", () => {
      it("should price it at NQ when NQ sells more per day", async () => {
        marketDataByRegion({
          Europe: regionMarketData({
            dataCenter: "Light",
            nqBuyPrice: 400,
            hqBuyPrice: 1900,
            nqSaleVelocity: 10,
            hqSaleVelocity: 5,
          }),
        });

        const { result } = renderHook(() =>
          useScannedItemProfits([1], {}, config, alice),
        );

        await waitFor(() => rowFor(result, 1));
        expect(rowFor(result, 1)).toMatchObject({
          item: { hq: false },
          analysis: { sellPricePerUnit: 1000 },
        });
      });

      it("should price it at HQ when HQ sells more per day, even if NQ would be more profitable", async () => {
        marketDataByRegion({
          Europe: regionMarketData({
            dataCenter: "Light",
            nqBuyPrice: 400,
            hqBuyPrice: 1900,
            nqSaleVelocity: 5,
            hqSaleVelocity: 10,
          }),
        });

        const { result } = renderHook(() =>
          useScannedItemProfits([1], {}, config, alice),
        );

        await waitFor(() => rowFor(result, 1));
        expect(rowFor(result, 1)).toMatchObject({
          item: { hq: true },
          analysis: { sellPricePerUnit: 2000 },
        });
      });

      it("should price it at NQ when both qualities sell equally", async () => {
        const { result } = renderHook(() =>
          useScannedItemProfits([1], {}, config, alice),
        );

        await waitFor(() => rowFor(result, 1));
        expect(rowFor(result, 1).item.hq).toBe(false);
      });

      it("should price it at the same quality through every buying region, including one whose fetch failed", async () => {
        const hqInDemand = (dataCenter: string, hqBuyPrice: number) =>
          regionMarketData({
            dataCenter,
            nqBuyPrice: 100,
            hqBuyPrice,
            nqSaleVelocity: 5,
            hqSaleVelocity: 10,
          });
        marketDataByRegion({
          Europe: hqInDemand("Light", 1900),
          Japan: hqInDemand("Elemental", 1000),
        });
        const threeRegionConfig: TradingConfig = {
          ...config,
          buyingRegions: [
            ...config.buyingRegions,
            { region: "Oceania", characters: [{ name: "Carol" }] },
          ],
        };

        const { result } = renderHook(() =>
          useScannedItemProfits([1], {}, threeRegionConfig, alice),
        );

        await waitFor(() => rowFor(result, 1));
        expect(
          ["Europe", "Japan", "Oceania"].map(
            (region) => rowFor(result, 1, region).item.hq,
          ),
        ).toEqual([true, true, true]);
      });
    });

    it("should price it with the target quantity assumed for untracked items", async () => {
      const { result } = renderHook(() =>
        useScannedItemProfits([1], {}, config, alice),
      );

      await waitFor(() => rowFor(result, 1));
      expect(rowFor(result, 1).item.targetQuantity).toBe(99);
    });

    it("should report a buying region's error when its fetch fails, while still pricing the others", async () => {
      // Only Europe has market data — Japan's fetch fails.
      const { result } = renderHook(() =>
        useScannedItemProfits([1], {}, config, alice),
      );

      await waitFor(() => rowFor(result, 1));
      expect(rowFor(result, 1, "Europe").analysis).toMatchObject({
        status: "ready",
        buyDataCenter: "Light",
      });
      expect(rowFor(result, 1, "Japan")).toMatchObject({
        analysis: { status: "pending" },
        lastAttemptFailed: true,
        lastErrorMessage: "No market data for Japan",
      });
    });

    it("should use the item's name once it's known, without fetching again", async () => {
      const itemIds = [1];
      const { result, rerender } = renderHook(
        ({ itemNames }) =>
          useScannedItemProfits(itemIds, itemNames, config, alice),
        { initialProps: { itemNames: {} as Record<number, string> } },
      );
      await waitFor(() => rowFor(result, 1));
      expect(rowFor(result, 1).item.name).toBe("#1");

      rerender({ itemNames: { 1: "Wind Cluster" } });

      expect(rowFor(result, 1).item.name).toBe("Wind Cluster");
      expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(2);
    });
  });

  describe("when an item can't be priced", () => {
    it("should stop showing it as loading, with nothing to show instead, once every region's fetch has failed", async () => {
      mockedFetchRowMarketData.mockRejectedValue(new Error("Gateway timeout"));

      const { result } = renderHook(() =>
        useScannedItemProfits([1], {}, config, alice),
      );

      await waitFor(() => expect(result.current).toEqual({}));
    });
  });
});
