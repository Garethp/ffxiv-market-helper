// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScannedItem, ScanStatus } from "../hooks/useHighVolumeItemScan";
import type { RowMarketData } from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, TradingParameters } from "../types";

vi.mock("../hooks/useHighVolumeItemScan");
vi.mock("../api/xivapi", () => ({ fetchItemNames: vi.fn() }));
vi.mock("../services/rowAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/rowAnalysis")>();
  return { ...actual, fetchRowMarketData: vi.fn() };
});

import { fetchItemNames } from "../api/xivapi";
import { useHighVolumeItemScan } from "../hooks/useHighVolumeItemScan";
import { fetchRowMarketData } from "../services/rowAnalysis";
import { withQueryClient } from "../testing/withQueryClient";
import { HighVolumeItemsContainer } from "./HighVolumeItemsContainer";

const mockedUseHighVolumeItemScan = vi.mocked(useHighVolumeItemScan);
const mockedFetchItemNames = vi.mocked(fetchItemNames);
const mockedFetchRowMarketData = vi.mocked(fetchRowMarketData);

type ScanState = ReturnType<typeof useHighVolumeItemScan>;

const config: TradingConfig = {
  trackedItems: [],
  characters: [],
  regions: [],
  params: {
    sellHistoryFetchCount: 100,
    saleVelocityWindowMs: 86_400_000,
  } as TradingParameters,
  marketBoardCities: [],
  buyingRegions: [],
  ownRetainers: [],
};

/** A promise whose resolution is controlled from outside. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const statusAt = (scannedItems: number): ScanStatus => {
  return {
    state: "running",
    scannedItems,
    totalItems: 1000,
  };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HighVolumeItemsContainer", () => {
  describe("pricing the top results", () => {
    const alice: Character = {
      id: "alice",
      name: "Alice",
      homeWorld: "Raiden",
      retainers: [],
    };
    const pricingConfig: TradingConfig = {
      ...config,
      buyingRegions: [
        { region: "Europe", characters: [{ id: "alice", name: "Alice" }] },
      ],
    };
    /** Item 52 sells fastest, down to item 1 selling slowest. */
    const results: ScannedItem[] = Array.from({ length: 52 }, (_, i) => ({
      itemId: i + 1,
      nqSaleVelocity: i + 1,
      hqSaleVelocity: 0,
      totalSaleVelocity: i + 1,
    }));
    const fastestFifty = Array.from({ length: 50 }, (_, i) => 52 - i);
    const pricedItemIds = () =>
      mockedFetchRowMarketData.mock.calls.map(([, itemId]) => itemId);

    it("should price the 50 fastest-selling items once the scan finishes, and not while it's still running", async () => {
      mockedFetchItemNames.mockResolvedValue(new Map());
      mockedFetchRowMarketData.mockReturnValue(new Promise(() => {}));
      let setScanState!: (state: ScanState) => void;
      mockedUseHighVolumeItemScan.mockImplementation(() => {
        const [state, setState] = useState<ScanState>({
          status: statusAt(500),
          results,
          startScan: vi.fn(),
        });
        setScanState = setState;
        return state;
      });

      render(
        <MemoryRouter>
          <HighVolumeItemsContainer
            config={pricingConfig}
            currentCharacter={alice}
          />
        </MemoryRouter>,
        { wrapper: withQueryClient() },
      );
      expect(mockedFetchRowMarketData).not.toHaveBeenCalled();

      await act(async () => {
        setScanState({
          status: {
            state: "done",
            scannedItems: 1000,
            totalItems: 1000,
            failedBatchCount: 0,
          },
          results,
          startScan: vi.fn(),
        });
      });

      expect(pricedItemIds()).toEqual(fastestFifty);
    });

    it("should price a previous scan's fastest-selling items straight away", async () => {
      mockedFetchItemNames.mockResolvedValue(new Map());
      mockedFetchRowMarketData.mockReturnValue(new Promise(() => {}));
      mockedUseHighVolumeItemScan.mockReturnValue({
        status: { state: "previous", completedAt: Date.now() },
        results,
        startScan: vi.fn(),
      });

      render(
        <MemoryRouter>
          <HighVolumeItemsContainer
            config={pricingConfig}
            currentCharacter={alice}
          />
        </MemoryRouter>,
        { wrapper: withQueryClient() },
      );

      await waitFor(() => expect(pricedItemIds()).toEqual(fastestFifty));
    });
  });

  describe("highlighting profitable items", () => {
    const alice: Character = {
      id: "alice",
      name: "Alice",
      homeWorld: "Raiden",
      retainers: [],
    };
    const pricingConfig: TradingConfig = {
      ...config,
      params: {
        ...config.params,
        buyTaxRate: 0,
        defaultSellTaxRate: 0,
        gapThresholdMultiplier: 1.1,
        saleSampleSize: 3,
        undercutListingThreshold: 5,
      },
      buyingRegions: [
        { region: "Europe", characters: [{ id: "alice", name: "Alice" }] },
      ],
    };
    /** Sells 10 a day at 100,000 and can be bought at 40,000 — 600,000 profit a day. */
    const marketData: RowMarketData = {
      sell: {
        itemID: 1,
        listings: [],
        recentHistory: [1, 2, 3].map(() => ({
          pricePerUnit: 100_000,
          quantity: 1,
          timestamp: 0,
          hq: false,
        })),
        nqSaleVelocity: 10,
        hqSaleVelocity: 0,
      },
      sellTaxRates: {},
      buy: [
        {
          dataCenter: "Light",
          data: {
            itemID: 1,
            listings: [
              {
                pricePerUnit: 40_000,
                quantity: 100,
                hq: false,
                retainerName: "Someone Else",
              },
            ],
            recentHistory: [],
            nqSaleVelocity: 0,
            hqSaleVelocity: 0,
          },
        },
      ],
    };

    it("should highlight items expected to make more than 500,000 a day until the highlight amount is changed", async () => {
      mockedFetchItemNames.mockResolvedValue(new Map());
      mockedFetchRowMarketData.mockResolvedValue(marketData);
      mockedUseHighVolumeItemScan.mockReturnValue({
        status: { state: "previous", completedAt: Date.now() },
        results: [
          {
            itemId: 1,
            nqSaleVelocity: 10,
            hqSaleVelocity: 0,
            totalSaleVelocity: 10,
          },
        ],
        startScan: vi.fn(),
      });

      const { container } = render(
        <MemoryRouter>
          <HighVolumeItemsContainer
            config={pricingConfig}
            currentCharacter={alice}
          />
        </MemoryRouter>,
        { wrapper: withQueryClient() },
      );
      const itemRow = () =>
        container.querySelector("table")!.querySelector(":scope > tbody > tr")!;

      await waitFor(() =>
        expect(itemRow().classList.contains("row-highlight")).toBe(true),
      );

      fireEvent.change(screen.getByLabelText("Highlight profit / day over"), {
        target: { value: "700k" },
      });

      expect(itemRow().classList.contains("row-highlight")).toBe(false);
    });
  });

  it("should not lose an item name that finishes loading after newer scan results have already arrived", async () => {
    const item: ScannedItem = {
      itemId: 1,
      nqSaleVelocity: 500,
      hqSaleVelocity: 0,
      totalSaleVelocity: 500,
    };
    const results = [item];

    let setScanState!: (state: ScanState) => void;
    mockedUseHighVolumeItemScan.mockImplementation(() => {
      const [state, setState] = useState<ScanState>({
        status: statusAt(400),
        results,
        startScan: vi.fn(),
      });
      setScanState = setState;
      return state;
    });

    const nameLookup = deferred<Map<number, string>>();
    mockedFetchItemNames.mockReturnValue(nameLookup.promise);

    // StrictMode matches production (main.tsx) — its dev-mode double-invoke of effects on first
    // render is what this test guards against re-triggering a duplicate lookup.
    render(
      <StrictMode>
        <MemoryRouter>
          <HighVolumeItemsContainer config={config} currentCharacter={null} />
        </MemoryRouter>
      </StrictMode>,
      { wrapper: withQueryClient() },
    );

    await waitFor(() => expect(mockedFetchItemNames).toHaveBeenCalledWith([1]));

    // Another batch completes — a fresh status object, but nowhere near the next checkpoint —
    // while the lookup above is still in flight.
    await act(async () => {
      setScanState({
        status: statusAt(420),
        results,
        startScan: vi.fn(),
      });
    });

    // The lookup finally resolves. Its result should still be applied, not silently discarded.
    await act(async () => {
      nameLookup.resolve(new Map([[1, "Aetherpool Arm"]]));
    });

    await waitFor(() => screen.getByText("Aetherpool Arm"));
  });

  it("should still look up names for a final stretch too short to cross the interval on its own", async () => {
    const item: ScannedItem = {
      itemId: 2,
      nqSaleVelocity: 300,
      hqSaleVelocity: 0,
      totalSaleVelocity: 300,
    };
    const results = [item];

    let setScanState!: (state: ScanState) => void;
    mockedUseHighVolumeItemScan.mockImplementation(() => {
      const [state, setState] = useState<ScanState>({
        status: statusAt(150),
        results,
        startScan: vi.fn(),
      });
      setScanState = setState;
      return state;
    });

    mockedFetchItemNames.mockResolvedValue(
      new Map([[2, "Grade 8 Dark Matter"]]),
    );

    render(
      <MemoryRouter>
        <HighVolumeItemsContainer config={config} currentCharacter={null} />
      </MemoryRouter>,
      { wrapper: withQueryClient() },
    );

    // Short of the next 200-item checkpoint — no lookup should fire yet.
    expect(mockedFetchItemNames).not.toHaveBeenCalled();

    // The scan finishes without the final stretch ever crossing the interval on its own.
    await act(async () => {
      setScanState({
        status: {
          state: "done",
          scannedItems: 150,
          totalItems: 1000,
          failedBatchCount: 0,
        },
        results,
        startScan: vi.fn(),
      });
    });

    await waitFor(() => screen.getByText("Grade 8 Dark Matter"));
  });

  describe("showing a previous scan", () => {
    const item: ScannedItem = {
      itemId: 3,
      nqSaleVelocity: 250,
      hqSaleVelocity: 50,
      totalSaleVelocity: 300,
    };
    const previousScan: ScanState = {
      status: {
        state: "previous",
        completedAt: Date.now(),
      },
      results: [item],
      startScan: vi.fn(),
    };

    it("should look up names for its results straight away", async () => {
      mockedUseHighVolumeItemScan.mockReturnValue(previousScan);
      mockedFetchItemNames.mockResolvedValue(new Map([[3, "Cordial"]]));

      render(
        <MemoryRouter>
          <HighVolumeItemsContainer config={config} currentCharacter={null} />
        </MemoryRouter>,
        { wrapper: withQueryClient() },
      );

      await waitFor(() => screen.getByText("Cordial"));
    });
  });
});
