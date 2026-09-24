import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Character,
  RegionInfo,
  TradingParameters,
  PricedItem,
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
import type { QueryClient } from "@tanstack/react-query";
import { createQueryClient } from "../queryClient";
import { analyzeRow, fetchRowMarketData } from "./rowAnalysis";

const mockedFetchMarketData = vi.mocked(fetchMarketData);
const mockedFetchTaxRates = vi.mocked(fetchTaxRates);

const regions: RegionInfo[] = [
  { name: "Europe", dataCenters: [{ name: "Light", worlds: ["WorldA"] }] },
];

const sellingCharacter: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "WorldA",
  retainers: [{ id: "retainer-a", name: "RetainerA", city: "Ul'dah" }],
};

const ownRetainers: WorldRetainer[] = [{ name: "RetainerA", world: "WorldA" }];

const item: PricedItem = {
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
  undercutListingThreshold: 3,
  undercutListingsShown: 10,
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

const buildListing = (
  overrides: Partial<UniversalisListing> = {},
): UniversalisListing => ({
  pricePerUnit: 100,
  quantity: 1,
  hq: false,
  retainerName: "Someone",
  ...overrides,
});

const buildSale = (
  overrides: Partial<UniversalisHistoryEntry> = {},
): UniversalisHistoryEntry => ({
  pricePerUnit: 100,
  quantity: 1,
  hq: false,
  timestamp: 1,
  ...overrides,
});

const mockMarketDataByScope = (
  byScope: Record<string, Partial<UniversalisMarketData>>,
) => {
  mockedFetchMarketData.mockImplementation(async (worldOrDataCenter) => ({
    ...emptyMarketData,
    ...byScope[worldOrDataCenter],
  }));
};

/** Fetches the row's market data and prices it, bought via Europe. */
const analyze = async (
  overrides: {
    item?: PricedItem;
    regions?: RegionInfo[];
    character?: Character;
  } = {},
) => {
  const character = overrides.character ?? sellingCharacter;
  const marketData = await fetchRowMarketData(
    createQueryClient(),
    (overrides.item ?? item).itemId,
    "Europe",
    character,
    overrides.regions ?? regions,
    params,
  );
  const analysis = analyzeRow(
    marketData,
    overrides.item ?? item,
    character,
    ownRetainers,
    params,
  );
  if (analysis.status !== "ready") throw new Error("expected a ready analysis");
  return analysis;
};

describe("row analysis", () => {
  beforeEach(() => {
    mockedFetchTaxRates.mockResolvedValue({});
  });

  describe("pricing a row", () => {
    describe("recognizing our own listings", () => {
      it("should recognize our own retainer's listing even when the market data doesn't say which world it's on", async () => {
        mockMarketDataByScope({
          WorldA: {
            // Real single-world Universalis responses never include worldName per listing.
            listings: [
              buildListing({ pricePerUnit: 500, retainerName: "RetainerA" }),
            ],
          },
        });

        const analysis = await analyze();

        expect(analysis.sellListingStatus).toEqual({
          state: "competitive",
          rank: 1,
        });
      });

      it("should not buy from our own retainers", async () => {
        mockMarketDataByScope({
          Light: {
            listings: [
              buildListing({
                pricePerUnit: 50,
                retainerName: "RetainerA",
                worldName: "WorldA",
              }),
              buildListing({ pricePerUnit: 300, worldName: "WorldA" }),
            ],
          },
        });

        const analysis = await analyze();

        expect(analysis.buy?.pricePerUnit).toBe(300);
      });
    });

    describe("choosing where to buy", () => {
      it("should buy from the data center with the cheapest consistent price", async () => {
        mockMarketDataByScope({
          Light: { listings: [buildListing({ pricePerUnit: 300 })] },
          Chaos: { listings: [buildListing({ pricePerUnit: 200 })] },
        });

        const analysis = await analyze({ regions: twoDataCenterRegions });

        expect(analysis.buyDataCenter).toBe("Chaos");
        expect(analysis.buy?.pricePerUnit).toBe(200);
      });

      it("should keep the first data center when two tie on price", async () => {
        mockMarketDataByScope({
          Light: { listings: [buildListing({ pricePerUnit: 200 })] },
          Chaos: { listings: [buildListing({ pricePerUnit: 200 })] },
        });

        const analysis = await analyze({ regions: twoDataCenterRegions });

        expect(analysis.buyDataCenter).toBe("Light");
      });

      it("should report no buy price, naming the first data center, when nothing is buyable anywhere", async () => {
        mockMarketDataByScope({});

        const analysis = await analyze({ regions: twoDataCenterRegions });

        expect(analysis.buy).toBeUndefined();
        expect(analysis.buyDataCenter).toBe("Light");
      });
    });

    describe("matching the tracked quality", () => {
      const hqItem: PricedItem = { ...item, hq: true };

      it("should only price purchases from listings of the tracked quality", async () => {
        mockMarketDataByScope({
          Light: {
            listings: [
              buildListing({ pricePerUnit: 10, hq: false }),
              buildListing({ pricePerUnit: 200, hq: true }),
            ],
          },
        });

        const analysis = await analyze({ item: hqItem });

        expect(analysis.buy?.pricePerUnit).toBe(200);
      });

      it("should only price sales from sale history and listings of the tracked quality", async () => {
        mockMarketDataByScope({
          WorldA: {
            recentHistory: [
              buildSale({ pricePerUnit: 1000, hq: true }),
              buildSale({ pricePerUnit: 50, hq: false }),
            ],
            listings: [
              buildListing({ pricePerUnit: 1050, hq: true }),
              buildListing({ pricePerUnit: 10_000, hq: false }),
            ],
          },
        });

        const analysis = await analyze({ item: hqItem });

        expect(analysis.sellPricePerUnit).toBe(1000);
        expect(analysis.gapDetected).toBe(false);
      });

      it("should only rank our listing against listings of the tracked quality", async () => {
        mockMarketDataByScope({
          WorldA: {
            listings: [
              ...[10, 20, 30, 40, 50, 60].map((pricePerUnit) =>
                buildListing({ pricePerUnit, hq: false }),
              ),
              buildListing({
                pricePerUnit: 500,
                hq: true,
                retainerName: "RetainerA",
              }),
            ],
          },
        });

        const analysis = await analyze({ item: hqItem });

        expect(analysis.sellListingStatus).toEqual({
          state: "competitive",
          rank: 1,
        });
      });

      it("should use HQ sale velocity for an HQ item", async () => {
        mockMarketDataByScope({
          WorldA: { hqSaleVelocity: 7, nqSaleVelocity: 3 },
        });

        const analysis = await analyze({ item: hqItem });

        expect(analysis.saleVelocityPerDay).toBe(7);
      });

      it("should use NQ sale velocity for an item that isn't HQ", async () => {
        mockMarketDataByScope({
          WorldA: { hqSaleVelocity: 7, nqSaleVelocity: 3 },
        });

        const analysis = await analyze();

        expect(analysis.saleVelocityPerDay).toBe(3);
      });
    });
  });

  describe("fetching a row's market data", () => {
    const twoRegionDirectory: RegionInfo[] = [
      ...regions,
      {
        name: "Japan",
        dataCenters: [{ name: "Elemental", worlds: ["WorldJ"] }],
      },
    ];

    const fetchRow = (
      client: QueryClient,
      region = "Europe",
      signal?: AbortSignal,
    ) =>
      fetchRowMarketData(
        client,
        item.itemId,
        region,
        sellingCharacter,
        twoRegionDirectory,
        params,
        signal,
      );

    /** Makes every request hang, and returns each one's cancellation signal by what it's for. */
    const makeRequestsHang = () => {
      const signals: Record<string, AbortSignal> = {};
      mockedFetchMarketData.mockImplementation(
        (worldOrDataCenter, _, options) => {
          signals[worldOrDataCenter] = options.signal!;
          return new Promise(() => {});
        },
      );
      mockedFetchTaxRates.mockImplementation((_, signal) => {
        signals.taxRates = signal!;
        return new Promise(() => {});
      });
      return signals;
    };

    beforeEach(() => {
      vi.clearAllMocks();
      mockMarketDataByScope({});
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should fail when a market data fetch fails", async () => {
      mockedFetchMarketData.mockRejectedValue(new Error("market down"));

      await expect(fetchRow(createQueryClient())).rejects.toThrow(
        "market down",
      );
    });

    it("should share one request between rows that want the same data at around the same time", async () => {
      const client = createQueryClient();

      await Promise.all([
        fetchRow(client, "Europe"),
        fetchRow(client, "Japan"),
      ]);

      expect(mockedFetchTaxRates).toHaveBeenCalledTimes(1);
      expect(
        mockedFetchMarketData.mock.calls.map(
          ([worldOrDataCenter]) => worldOrDataCenter,
        ),
      ).toEqual(["WorldA", "Light", "Elemental"]);
    });

    it("should fetch data again once it's more than 30 seconds old", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const client = createQueryClient();
      await fetchRow(client);

      vi.setSystemTime(Date.now() + 30_001);
      await fetchRow(client);

      expect(mockedFetchTaxRates).toHaveBeenCalledTimes(2);
    });

    it("should fetch data again after a failure rather than reusing the failure", async () => {
      mockedFetchTaxRates.mockRejectedValueOnce(new Error("tax rates down"));
      const client = createQueryClient();
      await expect(fetchRow(client)).rejects.toThrow("tax rates down");

      await fetchRow(client);

      expect(mockedFetchTaxRates).toHaveBeenCalledTimes(2);
    });

    describe("when a row stops waiting for its data", () => {
      it("should stop waiting straight away, cancelling its requests", async () => {
        const signals = makeRequestsHang();
        const controller = new AbortController();
        const row = fetchRow(createQueryClient(), "Europe", controller.signal);
        await vi.waitFor(() => expect(Object.keys(signals)).toHaveLength(3));

        controller.abort(new Error("Page closed"));

        await expect(row).rejects.toThrow("Page closed");
        await vi.waitFor(() =>
          expect(signals).toMatchObject({
            WorldA: { aborted: true },
            taxRates: { aborted: true },
            Light: { aborted: true },
          }),
        );
      });

      it("should keep requests going that another row is still waiting on", async () => {
        const signals = makeRequestsHang();
        const client = createQueryClient();
        const controller = new AbortController();
        fetchRow(client, "Europe", controller.signal).catch(() => {});
        fetchRow(client, "Japan");
        await vi.waitFor(() => expect(Object.keys(signals)).toHaveLength(4));

        controller.abort();

        await vi.waitFor(() => expect(signals.Light.aborted).toBe(true));
        expect(signals).toMatchObject({
          WorldA: { aborted: false },
          taxRates: { aborted: false },
          Elemental: { aborted: false },
        });
      });
    });
  });
});
