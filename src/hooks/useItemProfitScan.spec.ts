// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UniversalisMarketData } from "../api/universalis";
import type { RowMarketData } from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, TradingParameters } from "../types";

vi.mock("../api/xivapi", () => ({ fetchItemNames: vi.fn() }));
vi.mock("../services/rowAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/rowAnalysis")>();
  return { ...actual, fetchRowMarketData: vi.fn() };
});

import { fetchItemNames } from "../api/xivapi";
import { fetchRowMarketData } from "../services/rowAnalysis";
import { withQueryClient } from "../testing/withQueryClient";
import { useItemProfitScan } from "./useItemProfitScan";

const mockedFetchItemNames = vi.mocked(fetchItemNames);
const mockedFetchRowMarketData = vi.mocked(fetchRowMarketData);

/** A promise whose resolution is controlled from outside, to pin down fetch-ordering races. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const itemId = 42;

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
  buyingRegions: [{ region: "Europe", characters: [{ name: "Alice" }] }],
  ownRetainers: [],
};

const sale = (pricePerUnit: number, hq: boolean) => ({
  pricePerUnit,
  quantity: 1,
  timestamp: 0,
  hq,
});

const listing = (pricePerUnit: number, quantity: number, hq: boolean) => ({
  pricePerUnit,
  quantity,
  hq,
  retainerName: "Someone Else",
});

const marketData = (
  data: Partial<UniversalisMarketData>,
): UniversalisMarketData => ({
  itemID: itemId,
  listings: [],
  recentHistory: [],
  nqSaleVelocity: 0,
  hqSaleVelocity: 0,
  ...data,
});

/** NQ sells for 1,000 and HQ for 2,000; NQ can be bought at 400 (10 available) or 600 (100 available). */
const europeMarketData: RowMarketData = {
  sell: marketData({
    recentHistory: [
      sale(1000, false),
      sale(1000, false),
      sale(1000, false),
      sale(2000, true),
      sale(2000, true),
      sale(2000, true),
    ],
  }),
  sellTaxRates: {},
  buy: [
    {
      dataCenter: "Light",
      data: marketData({
        listings: [listing(400, 10, false), listing(600, 100, false)],
      }),
    },
  ],
};

const europeAnalysis = (result: {
  current: ReturnType<typeof useItemProfitScan>;
}) => {
  const analysis = result.current.rowsByRegion["Europe"]?.[0]?.row.analysis;
  if (analysis?.status !== "ready") throw new Error("Not priced yet");
  return analysis;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchItemNames.mockResolvedValue(new Map());
  mockedFetchRowMarketData.mockResolvedValue(europeMarketData);
});

describe("useItemProfitScan", () => {
  it("should keep the item's real name even though a fetch that started before the name was known finishes afterward", async () => {
    const name = deferred<Map<number, string>>();
    mockedFetchItemNames.mockReturnValue(name.promise);
    const fetch = deferred<RowMarketData>();
    mockedFetchRowMarketData.mockReturnValue(fetch.promise);

    const { result } = renderHook(
      () => useItemProfitScan(itemId, config, alice),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => expect(mockedFetchRowMarketData).toHaveBeenCalled());
    expect(result.current.rowsByRegion["Europe"]?.[0]?.row.item.name).toBe(
      `Item #${itemId}`,
    );

    name.resolve(new Map([[itemId, "Real Item Name"]]));
    await waitFor(() => expect(result.current.itemName).toBe("Real Item Name"));
    fetch.resolve(europeMarketData);
    await waitFor(() => europeAnalysis(result));

    expect(result.current.rowsByRegion["Europe"]?.[0]?.row.item.name).toBe(
      "Real Item Name",
    );
  });

  describe("when it fetches market data", () => {
    it("should fetch again for a newly selected character, since that changes the world it's sold on", async () => {
      const { rerender } = renderHook(
        ({ character }) => useItemProfitScan(itemId, config, character),
        { initialProps: { character: alice }, wrapper: withQueryClient() },
      );
      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(1),
      );

      rerender({ character: bob });

      await waitFor(() =>
        expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(2),
      );
      expect(mockedFetchRowMarketData.mock.calls[1][3]).toBe(bob);
    });

    it("should report the region's error when its fetch fails", async () => {
      mockedFetchRowMarketData.mockRejectedValue(new Error("Gateway timeout"));

      const { result } = renderHook(
        () => useItemProfitScan(itemId, config, alice),
        { wrapper: withQueryClient() },
      );

      await waitFor(() =>
        expect(result.current.rowsByRegion["Europe"]?.[0]).toMatchObject({
          row: {
            analysis: { status: "pending" },
            lastAttemptFailed: true,
            lastErrorMessage: "Gateway timeout",
          },
          isRefreshing: false,
        }),
      );
    });
  });

  describe("when the item's settings change", () => {
    it("should reprice for the chosen quality without fetching again", async () => {
      const { result } = renderHook(
        () => useItemProfitScan(itemId, config, alice),
        { wrapper: withQueryClient() },
      );
      await waitFor(() => europeAnalysis(result));
      expect(europeAnalysis(result).sellPricePerUnit).toBe(1000);

      act(() => result.current.setHq(true));

      expect(europeAnalysis(result).sellPricePerUnit).toBe(2000);
      expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(1);
    });

    it("should reprice for the target quantity without fetching again", async () => {
      const { result } = renderHook(
        () => useItemProfitScan(itemId, config, alice),
        { wrapper: withQueryClient() },
      );
      await waitFor(() => europeAnalysis(result));

      act(() => result.current.setTargetQuantity(10));
      expect(europeAnalysis(result).buy?.pricePerUnit).toBe(400);

      act(() => result.current.setTargetQuantity(20));
      expect(europeAnalysis(result).buy?.pricePerUnit).toBe(500);

      expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(1);
    });

    it("should cap the sell price at the sell price ceiling without fetching again", async () => {
      const { result } = renderHook(
        () => useItemProfitScan(itemId, config, alice),
        { wrapper: withQueryClient() },
      );
      await waitFor(() => europeAnalysis(result));

      act(() => result.current.setSellPriceCeiling(800));

      expect(europeAnalysis(result)).toMatchObject({
        sellPricePerUnit: 800,
        sellPriceCapped: true,
      });
      expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(1);
    });
  });
});
