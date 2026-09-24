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
import { createQueryClientWrapper } from "../testing/createQueryClientWrapper";
import { useScannedItemProfits } from "./useScannedItemProfits";

const mockedFetchRowMarketData = vi.mocked(fetchRowMarketData);

/** A promise whose resolution is controlled from outside, to pin down fetch-ordering races. */
const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

/** The items, with no names known. */
const buildUnnamedItems = (itemIds: number[]) =>
  itemIds.map((itemId) => ({ itemId, name: undefined }));

const alice: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "WorldA",
  retainers: [],
};
const bob: Character = {
  id: "bob",
  name: "Bob",
  homeWorld: "WorldB",
  retainers: [],
};

const config: TradingConfig = {
  trackedItems: [],
  characters: [alice, bob],
  regions: [],
  params: {
    buyTaxRate: 0,
    defaultSellTaxRate: 0,
    gapThresholdMultiplier: 1.1,
    saleSampleSize: 3,
    undercutListingThreshold: 3,
    undercutListingsShown: 10,
  } as TradingParameters,
  marketBoardCities: [],
  buyingRegions: [
    { region: "Europe", characters: [{ id: "alice", name: "Alice" }] },
    { region: "Japan", characters: [{ id: "bob", name: "Bob" }] },
  ],
  ownRetainers: [],
};

const buildSales = (pricePerUnit: number, hq: boolean) =>
  [1, 2, 3].map(() => ({ pricePerUnit, quantity: 1, timestamp: 0, hq }));

const buildListing = (pricePerUnit: number, hq: boolean) => ({
  pricePerUnit,
  quantity: 100,
  hq,
  retainerName: "Someone Else",
});

const buildMarketData = (
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
const buildRegionMarketData = ({
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
  sell: buildMarketData({
    recentHistory: [...buildSales(1000, false), ...buildSales(2000, true)],
    nqSaleVelocity,
    hqSaleVelocity,
  }),
  sellTaxRates: {},
  buy: [
    {
      dataCenter,
      data: buildMarketData({
        listings: [
          buildListing(nqBuyPrice, false),
          buildListing(hqBuyPrice, true),
        ],
      }),
    },
  ],
});

/** Answers each buying region's fetch with the market data given for it. */
const mockMarketDataByRegion = (byRegion: Record<string, RowMarketData>) => {
  mockedFetchRowMarketData.mockImplementation(
    async (_client, _itemId, region) => {
      const data = byRegion[region];
      if (!data) throw new Error(`No market data for ${region}`);
      return data;
    },
  );
};

/** The item's row for one buying region, once it's been priced. */
const getRowFor = (
  result: { current: ReturnType<typeof useScannedItemProfits> },
  itemId: number,
  region = "Europe",
) => {
  const profit = result.current[itemId];
  if (profit?.status !== "ready") throw new Error("Not priced yet");
  return profit.rowByRegion[region];
};

describe("useScannedItemProfits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarketDataByRegion({
      Europe: buildRegionMarketData({
        dataCenter: "Light",
        nqBuyPrice: 400,
        hqBuyPrice: 1900,
      }),
    });
  });

  describe("which items it prices", () => {
    it("should fetch every item across every buying region, selling through the given character", async () => {
      const itemIds = [1, 2];
      renderHook(
        () => useScannedItemProfits(buildUnnamedItems(itemIds), config, alice),
        {
          wrapper: createQueryClientWrapper(),
        },
      );

      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(4),
      );
      expect(
        mockedFetchRowMarketData.mock.calls.map(
          ([, itemId, region, character]) => [itemId, region, character],
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
        ({ itemIds }) =>
          useScannedItemProfits(buildUnnamedItems(itemIds), config, alice),
        { initialProps: { itemIds: [1] }, wrapper: createQueryClientWrapper() },
      );
      await waitFor(() => getRowFor(result, 1));

      rerender({ itemIds: [] });

      expect(result.current).toEqual({});
    });

    it("should not let a fetch for items that are no longer being priced come back and show them", async () => {
      const fetch = createDeferred<RowMarketData>();
      mockedFetchRowMarketData.mockReturnValue(fetch.promise);
      const { result, rerender } = renderHook(
        ({ itemIds }) =>
          useScannedItemProfits(buildUnnamedItems(itemIds), config, alice),
        { initialProps: { itemIds: [1] }, wrapper: createQueryClientWrapper() },
      );
      await waitFor(() => expect(mockedFetchRowMarketData).toHaveBeenCalled());

      rerender({ itemIds: [] });
      await act(async () => {
        fetch.resolve(
          buildRegionMarketData({
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
          useScannedItemProfits(buildUnnamedItems(itemIds), config, character),
        {
          initialProps: { character: alice },
          wrapper: createQueryClientWrapper(),
        },
      );
      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(2),
      );

      rerender({ character: bob });

      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(4),
      );
      expect(mockedFetchRowMarketData.mock.calls[2][3]).toBe(bob);
    });
  });

  describe("abandoning pricing that's still under way", () => {
    /** The cancellation signal each fetch so far was given. */
    const getFetchSignals = () =>
      mockedFetchRowMarketData.mock.calls.map((call) => call[6]!);

    beforeEach(() => {
      mockedFetchRowMarketData.mockReturnValue(new Promise(() => {}));
    });

    it("should cancel fetches for items that are no longer being priced", async () => {
      const { rerender } = renderHook(
        ({ itemIds }) =>
          useScannedItemProfits(buildUnnamedItems(itemIds), config, alice),
        {
          initialProps: { itemIds: [1, 2] },
          wrapper: createQueryClientWrapper(),
        },
      );
      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(4),
      );

      rerender({ itemIds: [2] });

      await waitFor(() =>
        expect(getFetchSignals().map((signal) => signal.aborted)).toEqual([
          true,
          true,
          false,
          false,
        ]),
      );
    });
  });

  describe("while an item is being priced", () => {
    it("should show it as loading", () => {
      mockedFetchRowMarketData.mockReturnValue(
        createDeferred<RowMarketData>().promise,
      );

      const { result } = renderHook(
        () => useScannedItemProfits(buildUnnamedItems([1]), config, alice),
        {
          wrapper: createQueryClientWrapper(),
        },
      );

      expect(result.current[1]).toEqual({ status: "loading" });
    });
  });

  describe("once an item is priced", () => {
    it("should price it through each buying region separately", async () => {
      mockMarketDataByRegion({
        Europe: buildRegionMarketData({
          dataCenter: "Light",
          nqBuyPrice: 400,
          hqBuyPrice: 1900,
        }),
        Japan: buildRegionMarketData({
          dataCenter: "Elemental",
          nqBuyPrice: 100,
          hqBuyPrice: 1900,
        }),
      });

      const { result } = renderHook(
        () => useScannedItemProfits(buildUnnamedItems([1]), config, alice),
        {
          wrapper: createQueryClientWrapper(),
        },
      );

      await waitFor(() => getRowFor(result, 1));
      expect(getRowFor(result, 1, "Europe").analysis).toMatchObject({
        buyDataCenter: "Light",
        expectedProfitPerDay: 6000,
      });
      expect(getRowFor(result, 1, "Japan").analysis).toMatchObject({
        buyDataCenter: "Elemental",
        expectedProfitPerDay: 9000,
      });
    });

    describe("choosing its quality", () => {
      it("should price it at HQ when HQ sells more per day, even if NQ would be more profitable", async () => {
        mockMarketDataByRegion({
          Europe: buildRegionMarketData({
            dataCenter: "Light",
            nqBuyPrice: 400,
            hqBuyPrice: 1900,
            nqSaleVelocity: 5,
            hqSaleVelocity: 10,
          }),
        });

        const { result } = renderHook(
          () => useScannedItemProfits(buildUnnamedItems([1]), config, alice),
          {
            wrapper: createQueryClientWrapper(),
          },
        );

        await waitFor(() => getRowFor(result, 1));
        expect(getRowFor(result, 1)).toMatchObject({
          item: { hq: true },
          analysis: { sellPricePerUnit: 2000 },
        });
      });

      it("should price it at NQ when both qualities sell equally", async () => {
        const { result } = renderHook(
          () => useScannedItemProfits(buildUnnamedItems([1]), config, alice),
          {
            wrapper: createQueryClientWrapper(),
          },
        );

        await waitFor(() => getRowFor(result, 1));
        expect(getRowFor(result, 1).item.hq).toBe(false);
      });

      it("should price it at the same quality through every buying region, including one whose fetch failed", async () => {
        const buildHqInDemandData = (dataCenter: string, hqBuyPrice: number) =>
          buildRegionMarketData({
            dataCenter,
            nqBuyPrice: 100,
            hqBuyPrice,
            nqSaleVelocity: 5,
            hqSaleVelocity: 10,
          });
        mockMarketDataByRegion({
          Europe: buildHqInDemandData("Light", 1900),
          Japan: buildHqInDemandData("Elemental", 1000),
        });
        const threeRegionConfig: TradingConfig = {
          ...config,
          buyingRegions: [
            ...config.buyingRegions,
            { region: "Oceania", characters: [{ id: "carol", name: "Carol" }] },
          ],
        };

        const { result } = renderHook(
          () =>
            useScannedItemProfits(
              buildUnnamedItems([1]),
              threeRegionConfig,
              alice,
            ),
          {
            wrapper: createQueryClientWrapper(),
          },
        );

        await waitFor(() => getRowFor(result, 1));
        expect(
          ["Europe", "Japan", "Oceania"].map(
            (region) => getRowFor(result, 1, region).item.hq,
          ),
        ).toEqual([true, true, true]);
      });
    });

    it("should price it with the target quantity assumed for untracked items", async () => {
      const { result } = renderHook(
        () => useScannedItemProfits(buildUnnamedItems([1]), config, alice),
        {
          wrapper: createQueryClientWrapper(),
        },
      );

      await waitFor(() => getRowFor(result, 1));
      expect(getRowFor(result, 1).item.targetQuantity).toBe(99);
    });

    it("should still price the other buying regions when one's fetch fails", async () => {
      // Only Europe has market data — Japan's fetch fails.
      const { result } = renderHook(
        () => useScannedItemProfits(buildUnnamedItems([1]), config, alice),
        {
          wrapper: createQueryClientWrapper(),
        },
      );

      await waitFor(() => getRowFor(result, 1));
      expect(getRowFor(result, 1, "Europe").analysis).toMatchObject({
        status: "ready",
        buyDataCenter: "Light",
      });
      expect(getRowFor(result, 1, "Japan").analysis).toEqual({
        status: "pending",
      });
    });

    it("should price the item under its name, or its ID when it has none", async () => {
      const { result } = renderHook(
        () =>
          useScannedItemProfits(
            [
              { itemId: 1, name: "Wind Cluster" },
              { itemId: 2, name: undefined },
            ],
            config,
            alice,
          ),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => getRowFor(result, 2));
      expect(getRowFor(result, 1).item.name).toBe("Wind Cluster");
      expect(getRowFor(result, 2).item.name).toBe("#2");
    });
  });

  describe("when an item can't be priced", () => {
    it("should stop showing it as loading, with nothing to show instead, once every region's fetch has failed", async () => {
      mockedFetchRowMarketData.mockRejectedValue(new Error("Gateway timeout"));

      const { result } = renderHook(
        () => useScannedItemProfits(buildUnnamedItems([1]), config, alice),
        {
          wrapper: createQueryClientWrapper(),
        },
      );

      await waitFor(() => expect(result.current).toEqual({}));
    });
  });
});
