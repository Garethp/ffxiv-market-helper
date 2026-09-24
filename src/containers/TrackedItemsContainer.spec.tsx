// @vitest-environment jsdom
import { defaultScheduler, notifyManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, within } from "@testing-library/react";
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
import { buildMarketPageUrl } from "../api/universalis";
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
import { getColumnHeaderNames } from "../testing/getColumnHeaderNames";
import { createQueryClientWrapper } from "../testing/createQueryClientWrapper";
import { TrackedItemsContainer } from "./TrackedItemsContainer";

const mockedFetchRowMarketData = vi.mocked(fetchRowMarketData);

const alice: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "Raiden",
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
  characters: [alice],
  regions: [],
  params: {
    buyTaxRate: 0,
    defaultSellTaxRate: 0,
    gapThresholdMultiplier: 1.1,
    saleSampleSize: 3,
    undercutListingThreshold: 3,
    undercutListingsShown: 10,
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

/** Sells for 1,000, and can be bought for the given price on the given data center. */
const buildRowMarketData = (
  dataCenter: string,
  buyPricePerUnit: number,
): RowMarketData => ({
  sell: buildMarketData({
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
      dataCenter,
      data: buildMarketData({
        listings: [
          {
            pricePerUnit: buyPricePerUnit,
            quantity: 100,
            hq: false,
            retainerName: "Someone Else",
          },
        ],
      }),
    },
  ],
});

const renderContainer = (currentCharacter: Character = alice) =>
  render(
    <TrackedItemsContainer
      config={config}
      currentCharacter={currentCharacter}
    />,
    { wrapper: createQueryClientWrapper() },
  );

/** Lets fetches settle, and runs whatever is due within the given time. */
const advance = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const getRegionSection = (headingText: string) =>
  screen.getByRole("heading", { name: headingText }).closest("section")!;

/** The text of a section's first item row, in the column with the given header. */
const getCellText = (section: HTMLElement, columnHeader: string) => {
  const headers = getColumnHeaderNames(section);
  const [, itemRow] = within(section).getAllByRole("row");
  return within(itemRow).getAllByRole("cell")[headers.indexOf(columnHeader)]
    .textContent;
};

describe("TrackedItemsContainer", () => {
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
    mockedFetchRowMarketData.mockResolvedValue(
      buildRowMarketData("Light", 400),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("introducing the page", () => {
    it("should say which world it's selling on: the Current Character's home world", () => {
      renderContainer();

      expect(screen.getByText("Selling on Raiden")).not.toBeNull();
    });
  });

  describe("showing when rows were last updated", () => {
    it("should not show a last-updated time before any row has loaded", () => {
      mockedFetchRowMarketData.mockReturnValue(new Promise(() => {}));

      renderContainer();

      expect(screen.queryByText(/Last updated/)).toBeNull();
    });

    it("should show the time rows last loaded", async () => {
      renderContainer();
      await advance();

      expect(
        screen.getByText(
          `Last updated ${new Date(startTime).toLocaleTimeString()}`,
        ),
      ).not.toBeNull();
    });
  });

  describe("showing profit through each buying region", () => {
    it("should show each region's own prices in its section", async () => {
      mockedFetchRowMarketData.mockImplementation(
        async (_client, _itemId, region) =>
          region === "Europe"
            ? buildRowMarketData("Light", 400)
            : buildRowMarketData("Mana", 700),
      );

      renderContainer();
      await advance();

      const europe = getRegionSection("Buying via Alice (Europe)");
      const japan = getRegionSection("Buying via Bob (Japan)");
      expect(getCellText(europe, "Item")).toContain("Wind Cluster");
      expect(getCellText(europe, "Buy DC")).toBe("Light");
      expect(getCellText(europe, "Profit / item")).toBe("600");
      expect(getCellText(japan, "Item")).toContain("Wind Cluster");
      expect(getCellText(japan, "Buy DC")).toBe("Mana");
      expect(getCellText(japan, "Profit / item")).toBe("300");
    });

    it("should link each sell price to its market on the Current Character's home world", async () => {
      renderContainer();
      await advance();

      const sellPriceLink = within(
        getRegionSection("Buying via Alice (Europe)"),
      ).getByRole("link", { name: "1,000" });
      expect(sellPriceLink.getAttribute("href")).toBe(
        buildMarketPageUrl(1, "Raiden"),
      );
    });
  });
});
