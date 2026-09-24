// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScannedItem, ScanStatus } from "../hooks/useHighVolumeItemScan";
import type { RowMarketData } from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, TradingParameters } from "../types";

vi.mock("../hooks/useHighVolumeItemScan");
vi.mock("../services/rowAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/rowAnalysis")>();
  return { ...actual, fetchRowMarketData: vi.fn() };
});

import { useHighVolumeItemScan } from "../hooks/useHighVolumeItemScan";
import { fetchRowMarketData } from "../services/rowAnalysis";
import { createQueryClientWrapper } from "../testing/createQueryClientWrapper";
import { HighVolumeItemsContainer } from "./HighVolumeItemsContainer";

const mockedUseHighVolumeItemScan = vi.mocked(useHighVolumeItemScan);
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

const buildRunningStatus = (scannedItems: number): ScanStatus => {
  return {
    state: "running",
    scannedItems,
    totalItems: 1000,
  };
};

describe("HighVolumeItemsContainer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

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
      name: undefined,
      nqSaleVelocity: i + 1,
      hqSaleVelocity: 0,
      totalSaleVelocity: i + 1,
    }));
    const fastestFifty = Array.from({ length: 50 }, (_, i) => 52 - i);
    const getPricedItemIds = () =>
      mockedFetchRowMarketData.mock.calls.map(([, itemId]) => itemId);

    it("should price the 50 fastest-selling items once the scan finishes, and not while it's still running", async () => {
      mockedFetchRowMarketData.mockReturnValue(new Promise(() => {}));
      let setScanState!: (state: ScanState) => void;
      mockedUseHighVolumeItemScan.mockImplementation(() => {
        const [state, setState] = useState<ScanState>({
          status: buildRunningStatus(500),
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
        { wrapper: createQueryClientWrapper() },
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

      expect(getPricedItemIds()).toEqual(fastestFifty);
    });

    it("should price a previous scan's fastest-selling items straight away", async () => {
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
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => expect(getPricedItemIds()).toEqual(fastestFifty));
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
        undercutListingThreshold: 3,
        undercutListingsShown: 10,
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
      mockedFetchRowMarketData.mockResolvedValue(marketData);
      mockedUseHighVolumeItemScan.mockReturnValue({
        status: { state: "previous", completedAt: Date.now() },
        results: [
          {
            itemId: 1,
            name: undefined,
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
        { wrapper: createQueryClientWrapper() },
      );
      const getItemRow = () =>
        container.querySelector("table")!.querySelector(":scope > tbody > tr")!;

      await waitFor(() =>
        expect(getItemRow().classList.contains("row-highlight")).toBe(true),
      );

      fireEvent.change(screen.getByLabelText("Highlight profit / day over"), {
        target: { value: "700k" },
      });

      expect(getItemRow().classList.contains("row-highlight")).toBe(false);
    });
  });
});
