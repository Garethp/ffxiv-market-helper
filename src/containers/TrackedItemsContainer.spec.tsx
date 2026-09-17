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
import { columnHeaderNames } from "../testing/columnHeaderNames";
import { withQueryClient } from "../testing/withQueryClient";
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
    undercutListingThreshold: 5,
    refreshIntervalMs: 90_000,
    retryDelayMs: 10_000,
    staleWarningThresholdMs: 300_000,
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

/** Sells for 1,000, and can be bought for the given price on the given data center. */
const rowMarketData = (
  dataCenter: string,
  buyPricePerUnit: number,
): RowMarketData => ({
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
      dataCenter,
      data: marketData({
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

const renderContainer = (currentCharacter: Character | null = alice) =>
  render(
    <TrackedItemsContainer
      config={config}
      currentCharacter={currentCharacter}
    />,
    { wrapper: withQueryClient() },
  );

/** Lets fetches settle, and runs whatever is due within the given time. */
const advance = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const regionSection = (headingText: string) =>
  screen.getByRole("heading", { name: headingText }).closest("section")!;

/** The text of a section's first item row, in the column with the given header. */
const cellText = (section: HTMLElement, columnHeader: string) => {
  const headers = columnHeaderNames(section);
  const [, itemRow] = within(section).getAllByRole("row");
  return within(itemRow).getAllByRole("cell")[headers.indexOf(columnHeader)]
    .textContent;
};

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
  mockedFetchRowMarketData.mockResolvedValue(rowMarketData("Light", 400));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TrackedItemsContainer", () => {
  describe("introducing the page", () => {
    it("should title the page Tracked Items", () => {
      renderContainer();

      expect(document.title).toBe("Tracked Items");
      expect(
        screen.getByRole("heading", { level: 1, name: "Tracked Items" }),
      ).not.toBeNull();
    });

    it("should say which world items are being sold on", () => {
      renderContainer();

      expect(screen.getByText("Selling on Raiden")).not.toBeNull();
    });

    it("should show a placeholder for the sell world while there's no Current Character", () => {
      renderContainer(null);

      expect(screen.getByText("Selling on …")).not.toBeNull();
    });

    it("should say how often rows refresh", () => {
      renderContainer();

      expect(
        screen.getByText("Rows refresh automatically every 90s"),
      ).not.toBeNull();
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
    it("should show a section for each buying region, in order", () => {
      renderContainer();

      expect(
        screen
          .getAllByRole("heading", { level: 2 })
          .map((heading) => heading.textContent),
      ).toEqual(["Buying via Alice (Europe)", "Buying via Bob (Japan)"]);
    });

    it("should show each region's own prices in its section", async () => {
      mockedFetchRowMarketData.mockImplementation(
        async (_client, _itemId, region) =>
          region === "Europe"
            ? rowMarketData("Light", 400)
            : rowMarketData("Mana", 700),
      );

      renderContainer();
      await advance();

      const europe = regionSection("Buying via Alice (Europe)");
      const japan = regionSection("Buying via Bob (Japan)");
      expect(cellText(europe, "Item")).toContain("Wind Cluster");
      expect(cellText(europe, "Buy DC")).toBe("Light");
      expect(cellText(europe, "Profit / item")).toBe("600");
      expect(cellText(japan, "Item")).toContain("Wind Cluster");
      expect(cellText(japan, "Buy DC")).toBe("Mana");
      expect(cellText(japan, "Profit / item")).toBe("300");
    });

    it("should link each sell price to its market on the Current Character's home world", async () => {
      renderContainer();
      await advance();

      const sellPriceLink = within(
        regionSection("Buying via Alice (Europe)"),
      ).getByRole("link", { name: "1,000" });
      expect(sellPriceLink.getAttribute("href")).toBe(
        buildMarketPageUrl(1, "Raiden"),
      );
    });

    it("should warn about a row whose fetches keep failing only once its last good data is older than the stale-warning threshold", async () => {
      renderContainer();
      await advance();

      mockedFetchRowMarketData.mockRejectedValue(new Error("Gateway timeout"));
      // The next refresh, and its retry, both fail — but the last good data is under 5 minutes old.
      await advance(90_000 + 10_000);
      const europe = regionSection("Buying via Alice (Europe)");
      expect(within(europe).queryByText("⚠")).toBeNull();

      // Refreshes keep failing until the last good data is over 5 minutes old.
      await advance(300_000);
      expect(within(europe).queryByText("⚠")).not.toBeNull();
    });
  });
});
