// @vitest-environment jsdom
import { defaultScheduler, notifyManager } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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
import { withQueryClient } from "../testing/withQueryClient";
import { useTrackedItemsAnalysis } from "./useTrackedItemsAnalysis";

const mockedFetchRowMarketData = vi.mocked(fetchRowMarketData);

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

const startTime = new Date("2026-09-17T12:00:00Z").getTime();

const config: TradingConfig = {
  trackedItems: [
    {
      id: "wind-cluster",
      itemId: 1,
      name: "Wind Cluster",
      stackSize: 1,
      targetQuantity: 10,
    },
  ],
  characters: [alice, bob],
  regions: [],
  params: {
    buyTaxRate: 0,
    defaultSellTaxRate: 0,
    gapThresholdMultiplier: 1.1,
    saleSampleSize: 3,
    undercutListingThreshold: 5,
    refreshIntervalMs: 90_000,
    retryDelayMs: 10_000,
  } as TradingParameters,
  marketBoardCities: [],
  buyingRegions: [
    { region: "Europe", characters: [{ id: "alice", name: "Alice" }] },
    { region: "Japan", characters: [{ id: "bob", name: "Bob" }] },
  ],
  ownRetainers: [],
};

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

/** Sells for 1,000 and can be bought for 400. */
const rowMarketData: RowMarketData = {
  sell: marketData({
    recentHistory: [1, 2, 3].map(() => ({
      pricePerUnit: 1000,
      quantity: 1,
      timestamp: 0,
      hq: false,
    })),
  }),
  sellTaxRates: {},
  buy: [
    {
      dataCenter: "Light",
      data: marketData({
        listings: [
          {
            pricePerUnit: 400,
            quantity: 100,
            hq: false,
            retainerName: "Someone Else",
          },
        ],
      }),
    },
  ],
};

const renderTrackedItems = (character: Character = alice) =>
  renderHook(({ character }) => useTrackedItemsAnalysis(config, character), {
    initialProps: { character },
    wrapper: withQueryClient(),
  });

/** Lets fetches settle, and runs whatever is due within the given time. */
const advance = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const europeRow = (result: {
  current: ReturnType<typeof useTrackedItemsAnalysis>;
}) => result.current.rowsByRegion["Europe"][0];

beforeAll(() => {
  // TanStack Query hands results to React on a zero-delay timer, which fake timers only run once
  // the clock moves past it. Handing them over straight away lets each test move the clock by
  // exactly the time it describes.
  notifyManager.setScheduler(queueMicrotask);
});

afterAll(() => {
  notifyManager.setScheduler(defaultScheduler);
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(startTime);
  mockedFetchRowMarketData.mockResolvedValue(rowMarketData);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useTrackedItemsAnalysis", () => {
  it("should show every tracked item in every buying region as refreshing until its market data arrives", () => {
    mockedFetchRowMarketData.mockReturnValue(new Promise(() => {}));

    const { result } = renderTrackedItems();

    for (const region of ["Europe", "Japan"]) {
      expect(result.current.rowsByRegion[region]).toMatchObject([
        {
          row: {
            item: { name: "Wind Cluster" },
            analysis: { status: "pending" },
          },
          isRefreshing: true,
        },
      ]);
    }
    expect(result.current.lastUpdated).toBeNull();
  });

  it("should price every tracked item through every buying region, selling through the Current Character", async () => {
    const { result } = renderTrackedItems();
    await advance();

    expect(
      mockedFetchRowMarketData.mock.calls.map(
        ([, itemId, region, character]) => [itemId, region, character],
      ),
    ).toEqual([
      [1, "Europe", alice],
      [1, "Japan", alice],
    ]);
    expect(europeRow(result)).toMatchObject({
      row: {
        analysis: { status: "ready", profitPerItem: 600 },
        lastSuccessAt: startTime,
        lastAttemptFailed: false,
      },
      isRefreshing: false,
    });
  });

  it("should price for a newly selected character's home world", async () => {
    const { rerender } = renderTrackedItems();
    await advance();

    rerender({ character: bob });
    await advance();

    expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(4);
    expect(mockedFetchRowMarketData.mock.calls[2][3]).toBe(bob);
  });

  describe("keeping rows up to date", () => {
    it("should fetch every row again each refresh interval", async () => {
      renderTrackedItems();
      await advance();

      await advance(89_999);
      expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(2);

      await advance(1);
      expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(4);
    });

    it("should report when rows were last updated", async () => {
      const { result } = renderTrackedItems();
      await advance();
      expect(result.current.lastUpdated).toEqual(new Date(startTime));

      await advance(90_000);

      expect(result.current.lastUpdated).toEqual(new Date(startTime + 90_000));
    });
  });

  describe("when a fetch fails", () => {
    it("should retry it once after the retry delay, only reporting the failure if that fails too", async () => {
      mockedFetchRowMarketData.mockRejectedValue(new Error("Gateway timeout"));
      const { result } = renderTrackedItems();
      await advance();
      expect(europeRow(result).row.lastAttemptFailed).toBe(false);

      await advance(10_000);

      expect(mockedFetchRowMarketData).toHaveBeenCalledTimes(4);
      expect(europeRow(result).row).toMatchObject({
        analysis: { status: "pending" },
        lastAttemptFailed: true,
        lastErrorMessage: "Gateway timeout",
      });
    });

    it("should keep showing the row's last good prices, flagged as failed, until a later refresh succeeds", async () => {
      const { result } = renderTrackedItems();
      await advance();

      mockedFetchRowMarketData.mockRejectedValue(new Error("Gateway timeout"));
      await advance(90_000 + 10_000);
      expect(europeRow(result).row).toMatchObject({
        analysis: { status: "ready", profitPerItem: 600 },
        lastSuccessAt: startTime,
        lastAttemptFailed: true,
        lastErrorMessage: "Gateway timeout",
      });

      mockedFetchRowMarketData.mockResolvedValue(rowMarketData);
      await advance(90_000);
      expect(europeRow(result).row).toMatchObject({
        lastSuccessAt: startTime + 190_000,
        lastAttemptFailed: false,
        lastErrorMessage: null,
      });
    });
  });
});
