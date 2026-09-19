// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ExpertDeliveryItem,
  ExpertDeliveryPrice,
} from "../services/expertDelivery";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, TradingParameters } from "../types";

vi.mock("../services/itemService", () => ({
  itemService: { getExpertDeliveryItems: vi.fn() },
}));
vi.mock("../hooks/useExpertDeliveryPrices", () => ({
  useExpertDeliveryPrices: vi.fn(),
}));

import { useExpertDeliveryPrices } from "../hooks/useExpertDeliveryPrices";
import { itemService } from "../services/itemService";
import { columnHeaderNames } from "../testing/columnHeaderNames";
import { withQueryClient } from "../testing/withQueryClient";
import { ExpertDeliveryContainer } from "./ExpertDeliveryContainer";

const mockedGetExpertDeliveryItems = vi.mocked(
  itemService.getExpertDeliveryItems,
);
const mockedUseExpertDeliveryPrices = vi.mocked(useExpertDeliveryPrices);

const alice: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "Zodiark",
  retainers: [],
};

const config: TradingConfig = {
  trackedItems: [],
  characters: [alice],
  regions: [
    {
      name: "Europe",
      dataCenters: [
        { name: "Chaos", worlds: ["Omega"] },
        { name: "Light", worlds: ["Zodiark"] },
      ],
    },
    { name: "Japan", dataCenters: [{ name: "Elemental", worlds: ["Aegis"] }] },
  ],
  params: {} as TradingParameters,
  marketBoardCities: [],
  buyingRegions: [],
  ownRetainers: [],
};

const cuirass: ExpertDeliveryItem = {
  itemId: 8455,
  name: "Augmented Wolfram Cuirass",
  itemLevel: 90,
  seals: 518,
};
const sword: ExpertDeliveryItem = {
  itemId: 1,
  name: "Some Sword",
  itemLevel: 560,
  seals: 1812,
};

const renderPage = (currentCharacter = alice) =>
  render(
    <ExpertDeliveryContainer
      config={config}
      currentCharacter={currentCharacter}
    />,
    { wrapper: withQueryClient() },
  );

const tableRows = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

const pricesGiven = (prices: Record<number, ExpertDeliveryPrice>) =>
  mockedUseExpertDeliveryPrices.mockReturnValue(prices);

beforeEach(() => {
  pricesGiven({});
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("ExpertDeliveryContainer", () => {
  describe("the items", () => {
    it("should list only items worth at least 150 seals", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([]);

      renderPage();

      await screen.findByRole("table");
      expect(mockedGetExpertDeliveryItems).toHaveBeenCalledExactlyOnceWith(150);
    });

    it("should say the items are loading until they've been fetched", () => {
      mockedGetExpertDeliveryItems.mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByText("Loading items…")).not.toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("should say why the items couldn't be fetched", async () => {
      mockedGetExpertDeliveryItems.mockRejectedValue(
        new Error("XIVAPI is down"),
      );

      renderPage();

      await screen.findByText("Couldn't load the items: XIVAPI is down");
      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  describe("pricing", () => {
    it("should price the items in the order they're listed, across the selected character's region", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);

      renderPage();

      await screen.findByRole("table");
      expect(mockedUseExpertDeliveryPrices).toHaveBeenLastCalledWith(
        [8455, 1],
        "Europe",
      );
      expect(screen.getByText("Buying in Europe")).not.toBeNull();
    });

    it("should say there's nowhere to price items, and price none, when the selected character's world isn't in a known region", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);

      renderPage({ ...alice, homeWorld: "Nowhere" });

      expect(
        screen.getByText(
          "Nowhere isn't a world we know the region of, so there's nowhere to price items.",
        ),
      ).not.toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
      // Nothing on the page changes once the items have loaded, so give them time to.
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      expect(mockedGetExpertDeliveryItems).toHaveBeenCalled();
      expect(
        mockedUseExpertDeliveryPrices.mock.calls.map(([itemIds]) => itemIds),
      ).not.toContainEqual([8455]);
    });
  });

  describe("the table", () => {
    it("should show each item's seals, and its cheapest listing once priced", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      pricesGiven({
        8455: {
          status: "listed",
          listing: { pricePerUnit: 1500, worldName: "Zodiark" },
        },
      });

      renderPage();

      await screen.findByRole("table");
      expect(columnHeaderNames(screen.getByRole("table"))).toEqual([
        "Item",
        "Item level",
        "Seals",
        "Lowest price",
        "Seals / gil",
        "Data center",
        "World",
      ]);
      expect(tableRows()).toEqual([
        [
          "Augmented Wolfram Cuirass",
          "90",
          "518",
          "1,500",
          "0.35",
          "Light",
          "Zodiark",
        ],
      ]);
    });

    it("should show an unknown data center for a world that isn't in the directory", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      pricesGiven({
        8455: {
          status: "listed",
          listing: { pricePerUnit: 1500, worldName: "Brand New World" },
        },
      });

      renderPage();

      await screen.findByRole("table");
      expect(tableRows()[0].slice(-2)).toEqual(["Unknown", "Brand New World"]);
    });

    it.each([
      [undefined, "Loading…"],
      [{ status: "unlisted" } as const, "No listings"],
      [{ status: "failed" } as const, "Couldn't fetch prices"],
    ])(
      "should say so in place of a price when pricing has given %o",
      async (price, text) => {
        mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
        pricesGiven(price ? { 8455: price } : {});

        renderPage();

        await screen.findByRole("table");
        expect(tableRows()).toEqual([
          ["Augmented Wolfram Cuirass", "90", "518", text],
        ]);
      },
    );

    it("should list priced items most seals per gil first, ahead of those not priced yet", async () => {
      const shield: ExpertDeliveryItem = {
        itemId: 2,
        name: "Some Shield",
        itemLevel: 100,
        seals: 600,
      };
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, shield, sword]);
      pricesGiven({
        8455: {
          status: "listed",
          listing: { pricePerUnit: 1000, worldName: "Omega" },
        },
        1: {
          status: "listed",
          listing: { pricePerUnit: 100, worldName: "Zodiark" },
        },
      });

      renderPage();

      await screen.findByRole("table");
      expect(tableRows().map(([name]) => name)).toEqual([
        "Some Sword",
        "Augmented Wolfram Cuirass",
        "Some Shield",
      ]);
    });
  });
});
