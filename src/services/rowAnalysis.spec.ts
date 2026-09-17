import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Character,
  RegionInfo,
  TradingParameters,
  TrackedItem,
} from "../types";
import type { WorldRetainer } from "../utils/pricing";

vi.mock("../api/universalis", () => ({
  fetchMarketData: vi.fn(),
  fetchTaxRates: vi.fn(),
}));

import {
  fetchMarketData,
  fetchTaxRates,
  type UniversalisHistoryEntry,
  type UniversalisListing,
  type UniversalisMarketData,
} from "../api/universalis";
import { applyFetchOutcome, fetchRowAnalysis, pendingRow } from "./rowAnalysis";
import type { FetchOutcome } from "./rowAnalysis";
import type { FlipRow, RowAnalysis } from "../types";

const mockedFetchMarketData = vi.mocked(fetchMarketData);
const mockedFetchTaxRates = vi.mocked(fetchTaxRates);

const regions: RegionInfo[] = [
  { name: "Europe", dataCenters: [{ name: "Light", worlds: ["WorldA"] }] },
];

const sellingCharacter: Character = {
  name: "Alice",
  homeWorld: "WorldA",
  retainers: [{ name: "RetainerA", city: "Ul'dah" }],
};

const ownRetainers: WorldRetainer[] = [{ name: "RetainerA", world: "WorldA" }];

const item: TrackedItem = {
  itemId: 1,
  name: "Test Item",
  stackSize: 1,
  targetQuantity: 1,
};

const params: TradingParameters = {
  buyTaxRate: 0,
  defaultSellTaxRate: 0.05,
  gapThresholdMultiplier: 1.1,
  saleSampleSize: 3,
  buyListingsFetchCount: 100,
  sellListingsFetchCount: 100,
  sellHistoryFetchCount: 100,
  saleVelocityWindowMs: 86_400_000,
  refreshIntervalMs: 90_000,
  retryDelayMs: 10_000,
  staleWarningThresholdMs: 300_000,
  undercutListingThreshold: 5,
};

const emptyMarketData = {
  itemID: item.itemId,
  listings: [],
  recentHistory: [],
  nqSaleVelocity: 0,
  hqSaleVelocity: 0,
};

const twoDataCenterRegions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [
      { name: "Light", worlds: ["WorldA"] },
      { name: "Chaos", worlds: ["WorldB"] },
    ],
  },
];

const listing = (
  overrides: Partial<UniversalisListing> = {},
): UniversalisListing => ({
  pricePerUnit: 100,
  quantity: 1,
  hq: false,
  retainerName: "Someone",
  ...overrides,
});

const sale = (
  overrides: Partial<UniversalisHistoryEntry> = {},
): UniversalisHistoryEntry => ({
  pricePerUnit: 100,
  quantity: 1,
  hq: false,
  timestamp: 1,
  ...overrides,
});

const marketDataByScope = (
  byScope: Record<string, Partial<UniversalisMarketData>>,
) => {
  mockedFetchMarketData.mockImplementation(async (worldOrDataCenter) => ({
    ...emptyMarketData,
    ...byScope[worldOrDataCenter],
  }));
};

const analyze = (
  overrides: {
    item?: TrackedItem;
    regions?: RegionInfo[];
    character?: Character;
  } = {},
) =>
  fetchRowAnalysis(
    overrides.item ?? item,
    "Europe",
    overrides.character ?? sellingCharacter,
    overrides.regions ?? regions,
    ownRetainers,
    params,
  );

const readyAnalysisOf = (outcome: FetchOutcome) => {
  if (!outcome.success) throw new Error("expected a successful fetch");
  if (outcome.analysis.status !== "ready")
    throw new Error("expected a ready analysis");
  return outcome.analysis;
};

beforeEach(() => {
  mockedFetchTaxRates.mockResolvedValue({});
});

describe("fetchRowAnalysis", () => {
  describe("recognizing our own listings", () => {
    it("should recognize our own retainer's listing even when the market data doesn't say which world it's on", async () => {
      marketDataByScope({
        WorldA: {
          // Real single-world Universalis responses never include worldName per listing.
          listings: [listing({ pricePerUnit: 500, retainerName: "RetainerA" })],
        },
      });

      const analysis = readyAnalysisOf(await analyze());

      expect(analysis.sellListingStatus).toEqual({
        state: "competitive",
        rank: 1,
      });
    });

    it("should not buy from our own retainers", async () => {
      marketDataByScope({
        Light: {
          listings: [
            listing({
              pricePerUnit: 50,
              retainerName: "RetainerA",
              worldName: "WorldA",
            }),
            listing({ pricePerUnit: 300, worldName: "WorldA" }),
          ],
        },
      });

      const analysis = readyAnalysisOf(await analyze());

      expect(analysis.buy?.pricePerUnit).toBe(300);
    });
  });

  describe("choosing where to buy", () => {
    it("should buy from the data center with the cheapest consistent price", async () => {
      marketDataByScope({
        Light: { listings: [listing({ pricePerUnit: 300 })] },
        Chaos: { listings: [listing({ pricePerUnit: 200 })] },
      });

      const analysis = readyAnalysisOf(
        await analyze({ regions: twoDataCenterRegions }),
      );

      expect(analysis.buyDataCenter).toBe("Chaos");
      expect(analysis.buy?.pricePerUnit).toBe(200);
    });

    it("should keep the first data center when two tie on price", async () => {
      marketDataByScope({
        Light: { listings: [listing({ pricePerUnit: 200 })] },
        Chaos: { listings: [listing({ pricePerUnit: 200 })] },
      });

      const analysis = readyAnalysisOf(
        await analyze({ regions: twoDataCenterRegions }),
      );

      expect(analysis.buyDataCenter).toBe("Light");
    });

    it("should report no buy price, naming the first data center, when nothing is buyable anywhere", async () => {
      marketDataByScope({});

      const analysis = readyAnalysisOf(
        await analyze({ regions: twoDataCenterRegions }),
      );

      expect(analysis.buy).toBeNull();
      expect(analysis.buyDataCenter).toBe("Light");
    });
  });

  describe("matching the tracked quality", () => {
    const hqItem: TrackedItem = { ...item, hq: true };

    it("should only price purchases from listings of the tracked quality", async () => {
      marketDataByScope({
        Light: {
          listings: [
            listing({ pricePerUnit: 10, hq: false }),
            listing({ pricePerUnit: 200, hq: true }),
          ],
        },
      });

      const analysis = readyAnalysisOf(await analyze({ item: hqItem }));

      expect(analysis.buy?.pricePerUnit).toBe(200);
    });

    it("should only price sales from sale history and listings of the tracked quality", async () => {
      marketDataByScope({
        WorldA: {
          recentHistory: [
            sale({ pricePerUnit: 1000, hq: true }),
            sale({ pricePerUnit: 50, hq: false }),
          ],
          listings: [
            listing({ pricePerUnit: 1050, hq: true }),
            listing({ pricePerUnit: 10_000, hq: false }),
          ],
        },
      });

      const analysis = readyAnalysisOf(await analyze({ item: hqItem }));

      expect(analysis.sellPricePerUnit).toBe(1000);
      expect(analysis.gapDetected).toBe(false);
    });

    it("should use HQ sale velocity for an HQ item", async () => {
      marketDataByScope({ WorldA: { hqSaleVelocity: 7, nqSaleVelocity: 3 } });

      const analysis = readyAnalysisOf(await analyze({ item: hqItem }));

      expect(analysis.saleVelocityPerDay).toBe(7);
    });

    it("should use NQ sale velocity for an item that isn't HQ", async () => {
      marketDataByScope({ WorldA: { hqSaleVelocity: 7, nqSaleVelocity: 3 } });

      const analysis = readyAnalysisOf(await analyze());

      expect(analysis.saleVelocityPerDay).toBe(3);
    });
  });

  describe("applying sell tax", () => {
    it("should price sales with the lowest tax rate among the selling character's retainers", async () => {
      mockedFetchTaxRates.mockResolvedValue({ "Ul'dah": 5, Kugane: 3 });
      marketDataByScope({
        WorldA: { recentHistory: [sale({ pricePerUnit: 1000 })] },
      });

      const analysis = readyAnalysisOf(
        await analyze({
          character: {
            ...sellingCharacter,
            retainers: [
              { name: "RetainerA", city: "Ul'dah" },
              { name: "RetainerB", city: "Kugane" },
            ],
          },
        }),
      );

      expect(analysis.effectiveSellPricePerUnit).toBeCloseTo(970);
    });
  });

  describe("handling failures", () => {
    it("should fail the row with the error message when a market data fetch fails", async () => {
      mockedFetchMarketData.mockRejectedValue(new Error("market down"));

      expect(await analyze()).toEqual({
        success: false,
        message: "market down",
      });
    });

    it("should fail the row with the error message when the tax rate fetch fails", async () => {
      marketDataByScope({});
      mockedFetchTaxRates.mockRejectedValue(new Error("tax rates down"));

      expect(await analyze()).toEqual({
        success: false,
        message: "tax rates down",
      });
    });

    it("should report an unknown error when something other than an Error is thrown", async () => {
      mockedFetchMarketData.mockRejectedValue("not an error");

      expect(await analyze()).toEqual({
        success: false,
        message: "Unknown error",
      });
    });
  });
});

describe("applyFetchOutcome", () => {
  const readyAnalysis: RowAnalysis = { status: "ready" } as RowAnalysis;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should replace the row with the fresh analysis on success, stamped with the current time", () => {
    const now = new Date("2026-01-01T12:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const previous: FlipRow = {
      ...pendingRow(item),
      lastAttemptFailed: true,
      lastErrorMessage: "previous failure",
    };
    const outcome: FetchOutcome = { success: true, analysis: readyAnalysis };

    const next = applyFetchOutcome(previous, item, outcome);

    expect(next.analysis).toBe(readyAnalysis);
    expect(next.lastAttemptFailed).toBe(false);
    expect(next.lastErrorMessage).toBeNull();
    expect(next.lastSuccessAt).toBe(now);
  });

  it("should preserve the previous row's analysis on failure, only stamping the failure", () => {
    const previous: FlipRow = {
      item,
      analysis: readyAnalysis,
      lastSuccessAt: 12345,
      lastAttemptFailed: false,
      lastErrorMessage: null,
    };
    const outcome: FetchOutcome = { success: false, message: "network error" };

    const next = applyFetchOutcome(previous, item, outcome);

    expect(next.analysis).toBe(readyAnalysis);
    expect(next.lastSuccessAt).toBe(12345);
    expect(next.lastAttemptFailed).toBe(true);
    expect(next.lastErrorMessage).toBe("network error");
  });

  it("should fall back to a pending row when a failure has nothing previous to preserve", () => {
    const outcome: FetchOutcome = { success: false, message: "network error" };

    const next = applyFetchOutcome(undefined, item, outcome);

    expect(next.analysis).toEqual({ status: "pending" });
    expect(next.lastAttemptFailed).toBe(true);
    expect(next.lastErrorMessage).toBe("network error");
  });
});
