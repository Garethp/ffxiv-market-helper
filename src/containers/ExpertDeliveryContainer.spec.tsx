// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegionListing } from "../api/universalis";
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
import { getColumnHeaderNames } from "../testing/getColumnHeaderNames";
import { createQueryClientWrapper } from "../testing/createQueryClientWrapper";
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
        { name: "Light", worlds: ["Zodiark", "Lich", "Odin"] },
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
    { wrapper: createQueryClientWrapper() },
  );

/** A cell's text as it reads, leaving out the copy button and its tooltip. */
const getCellText = (cell: HTMLElement) => {
  const copy = cell.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll('[role="tooltip"], button, a')
    .forEach((element) => element.remove());
  return copy.textContent;
};

const getRowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").map(getCellText));

const getTableRows = () => getRowsOf(screen.getByRole("table"));

const getItemNames = () => getTableRows().map(([name]) => name);

const stubPrices = (prices: Record<number, ExpertDeliveryPrice>) =>
  mockedUseExpertDeliveryPrices.mockReturnValue(prices);

const buildListing = (
  pricePerUnit: number,
  worldName = "Zodiark",
): RegionListing => ({
  pricePerUnit,
  worldName,
});

const buildListedPrice = (
  ...listings: RegionListing[]
): ExpertDeliveryPrice => ({
  status: "listed",
  listings,
});

const waitForItemsLoaded = () =>
  waitFor(() => expect(screen.queryByText("Loading items…")).toBeNull());

const setField = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const showRoute = () =>
  fireEvent.click(screen.getByRole("button", { name: "Route" }));

let writeText: ReturnType<typeof vi.fn>;

describe("ExpertDeliveryContainer", () => {
  beforeEach(() => {
    stubPrices({});
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe("the items", () => {
    it("should list only items worth at least 150 seals", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([]);

      renderPage();

      await waitForItemsLoaded();
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

      await waitFor(() =>
        expect(mockedUseExpertDeliveryPrices).toHaveBeenLastCalledWith(
          [8455, 1],
          "Europe",
        ),
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

    it("should say it's loading until every item has been priced", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      stubPrices({ 1: buildListedPrice(buildListing(100)) });

      const { rerender } = renderPage();
      await waitFor(() =>
        expect(mockedUseExpertDeliveryPrices).toHaveBeenLastCalledWith(
          [8455, 1],
          "Europe",
        ),
      );

      expect(screen.getByText("Loading items…")).not.toBeNull();
      expect(screen.queryByRole("table")).toBeNull();

      stubPrices({
        8455: buildListedPrice(buildListing(100)),
        1: buildListedPrice(buildListing(100)),
      });
      rerender(
        <ExpertDeliveryContainer config={config} currentCharacter={alice} />,
      );

      expect(screen.queryByText("Loading items…")).toBeNull();
      expect(getItemNames()).toEqual([
        "Some Sword",
        "Augmented Wolfram Cuirass",
      ]);
    });

    it("should say how many items couldn't be priced, in either view", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      stubPrices({
        8455: { status: "failed" },
        1: buildListedPrice(buildListing(100)),
      });

      renderPage();
      await waitForItemsLoaded();

      expect(
        screen.getByText("Couldn't fetch prices for 1 item."),
      ).not.toBeNull();
      showRoute();
      expect(
        screen.getByText("Couldn't fetch prices for 1 item."),
      ).not.toBeNull();
    });

    it("should say when no listings meet the filters, once everything's priced", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      stubPrices({
        8455: buildListedPrice(buildListing(5000)),
        1: { status: "unlisted" },
      });

      renderPage();
      await waitForItemsLoaded();

      expect(screen.getByText("No listings meet the filters.")).not.toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
      showRoute();
      expect(screen.getByText("No listings meet the filters.")).not.toBeNull();
    });
  });

  describe("filtering", () => {
    it("should start at a minimum of 4 seals per gil and a maximum price of 1k", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([]);

      renderPage();

      await waitForItemsLoaded();
      expect(
        (screen.getByLabelText("Minimum seals / gil") as HTMLInputElement)
          .value,
      ).toBe("4");
      expect(
        (screen.getByLabelText("Maximum price") as HTMLInputElement).value,
      ).toBe("1k");
    });

    it("should apply the limits as they're changed", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      stubPrices({
        8455: buildListedPrice(buildListing(100)),
        1: buildListedPrice(buildListing(500)),
      });

      renderPage();
      await waitForItemsLoaded();
      setField("Maximum price", "200");

      expect(getItemNames()).toEqual(["Augmented Wolfram Cuirass"]);

      setField("Maximum price", "");
      setField("Minimum seals / gil", "4");

      expect(getItemNames()).toEqual(["Augmented Wolfram Cuirass"]);
    });
  });

  describe("the list", () => {
    it("should show each item at its best listing, with how many listings meet the filters and their average seals per gil", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([sword]);
      stubPrices({
        // The last is worth too few seals per gil to count.
        1: buildListedPrice(
          buildListing(150, "Lich"),
          buildListing(100, "Omega"),
          buildListing(400),
          buildListing(500),
        ),
      });

      renderPage();
      await waitForItemsLoaded();

      expect(getColumnHeaderNames(screen.getByRole("table"))).toEqual([
        "Item",
        "Lowest price",
        "Seals / gil",
        "Seals",
        "Listings",
        "Average seals / gil",
        "World",
      ]);
      expect(getTableRows()).toEqual([
        ["Some Sword", "100", "18.12", "1,812", "3", "11.58", "Omega - Chaos"],
      ]);
    });

    it("should show only the world for a world that isn't in the directory", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      stubPrices({
        8455: buildListedPrice(buildListing(100, "Brand New World")),
      });

      renderPage();
      await waitForItemsLoaded();

      expect(getTableRows()[0].slice(-1)).toEqual(["Brand New World"]);
    });
  });

  describe("the route", () => {
    const buildItem = (
      itemId: number,
      name: string,
      seals: number,
    ): ExpertDeliveryItem => ({ itemId, name, itemLevel: 100, seals });

    /** Each data center's heading, followed by the headings of the worlds in it. */
    const getRouteHeadings = () =>
      screen
        .getAllByRole("heading", { level: 2 })
        .concat(screen.queryAllByRole("heading", { level: 3 }))
        .sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1,
        )
        .map((heading) => heading.textContent);

    const getWorldTable = (world: string) =>
      within(screen.getByRole("region", { name: world })).getByRole("table");

    it("should show the list until the route is picked", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([]);

      renderPage();
      await waitForItemsLoaded();

      const getAriaPressed = (name: string) =>
        screen.getByRole("button", { name }).getAttribute("aria-pressed");
      expect(getAriaPressed("List")).toBe("true");
      expect(getAriaPressed("Route")).toBe("false");
      showRoute();
      expect(getAriaPressed("List")).toBe("false");
      expect(getAriaPressed("Route")).toBe("true");
    });

    it("should visit the home world, then the rest of its data center, then other data centers, most seals first", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([
        buildItem(1, "On Omega", 5000),
        buildItem(2, "On Lich", 300),
        buildItem(3, "At home", 200),
        buildItem(4, "On Odin", 900),
      ]);
      stubPrices({
        1: buildListedPrice(buildListing(100, "Omega")),
        2: buildListedPrice(buildListing(50, "Lich")),
        3: buildListedPrice(buildListing(10, "Zodiark")),
        4: buildListedPrice(buildListing(100, "Odin")),
      });

      renderPage();
      await waitForItemsLoaded();
      showRoute();

      expect(getRouteHeadings()).toEqual([
        "Light",
        "Zodiark (home world) 1 listing, 200 seals",
        "Odin 1 listing, 900 seals",
        "Lich 1 listing, 300 seals",
        "Chaos",
        "Omega 1 listing, 5,000 seals",
      ]);
    });

    it("should buy an item at each of its listings, among the other listings on that world most seals per gil first", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([
        buildItem(1, "Sword", 900),
        buildItem(2, "Shield", 500),
      ]);
      stubPrices({
        1: buildListedPrice(
          buildListing(100, "Lich"),
          buildListing(120, "Omega"),
          buildListing(200, "Lich"),
        ),
        2: buildListedPrice(buildListing(100, "Lich")),
      });

      renderPage();
      await waitForItemsLoaded();
      showRoute();

      expect(getColumnHeaderNames(getWorldTable("Lich"))).toEqual([
        "Item",
        "Price",
        "Seals / gil",
        "Seals",
      ]);
      expect(getRowsOf(getWorldTable("Lich"))).toEqual([
        ["Sword", "100", "9.00", "900"],
        ["Shield", "100", "5.00", "500"],
        ["Sword", "200", "4.50", "900"],
      ]);
      expect(getRowsOf(getWorldTable("Omega"))).toEqual([
        ["Sword", "120", "7.50", "900"],
      ]);
      expect(
        screen.getByRole("heading", { name: "Lich 3 listings, 2,300 seals" }),
      ).not.toBeNull();
    });

    it("should put worlds it doesn't know the data center of last", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([
        buildItem(1, "Somewhere new", 5000),
        buildItem(2, "On Omega", 300),
      ]);
      stubPrices({
        1: buildListedPrice(buildListing(100, "Brand New World")),
        2: buildListedPrice(buildListing(50, "Omega")),
      });

      renderPage();
      await waitForItemsLoaded();
      showRoute();

      expect(getRouteHeadings()).toEqual([
        "Chaos",
        "Omega 1 listing, 300 seals",
        "Unknown data center",
        "Brand New World 1 listing, 5,000 seals",
      ]);
    });
  });

  describe("what an item is", () => {
    it("should show it when a name in the list is hovered", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      stubPrices({ [cuirass.itemId]: buildListedPrice(buildListing(100)) });
      renderPage();
      await waitForItemsLoaded();

      fireEvent.mouseEnter(screen.getByText("Augmented Wolfram Cuirass"));

      expect(document.querySelector(".item-summary-icon")).not.toBeNull();
    });
  });

  describe("copying an item name", () => {
    const getCopyButtonsFor = (name: string) =>
      screen
        .getAllByRole("row")
        .filter((row) => row.textContent?.includes(name))
        .map((row) =>
          within(row).getByRole("button", { name: "Copy item name" }),
        );

    const copy = async (name: string) => {
      await act(async () => {
        fireEvent.click(getCopyButtonsFor(name)[0]);
      });
    };

    const isMarkedCopied = (button: HTMLElement) =>
      button.textContent?.includes("Copied!") ?? false;

    const isNameMarkedCopied = (name: string) =>
      getCopyButtonsFor(name).every(isMarkedCopied);

    it("should copy the item's name from the list, and mark only that item as copied", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      stubPrices({
        8455: buildListedPrice(buildListing(100)),
        1: buildListedPrice(buildListing(100)),
      });

      renderPage();
      await waitForItemsLoaded();
      await copy("Some Sword");

      expect(writeText).toHaveBeenCalledWith("Some Sword");
      expect(isNameMarkedCopied("Some Sword")).toBe(true);
      expect(isNameMarkedCopied("Augmented Wolfram Cuirass")).toBe(false);
    });

    it("should mark only the route listing copied from, not the item's other listings on that world or others", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      stubPrices({
        8455: buildListedPrice(buildListing(100, "Omega")),
        1: buildListedPrice(
          buildListing(100),
          buildListing(100),
          buildListing(100, "Omega"),
        ),
      });

      renderPage();
      await waitForItemsLoaded();
      showRoute();
      await copy("Augmented Wolfram Cuirass");
      await copy("Some Sword");

      expect(writeText).toHaveBeenLastCalledWith("Some Sword");
      expect(getCopyButtonsFor("Some Sword").map(isMarkedCopied)).toEqual([
        true,
        false,
        false,
      ]);
      expect(isNameMarkedCopied("Augmented Wolfram Cuirass")).toBe(false);
    });

    it("should stop marking the item as copied after a short delay", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      stubPrices({ 8455: buildListedPrice(buildListing(100)) });

      renderPage();
      await waitForItemsLoaded();
      vi.useFakeTimers();
      await copy("Augmented Wolfram Cuirass");
      act(() => {
        vi.advanceTimersByTime(1499);
      });
      expect(isNameMarkedCopied("Augmented Wolfram Cuirass")).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(isNameMarkedCopied("Augmented Wolfram Cuirass")).toBe(false);
    });

    it.each([["another item", "Some Sword"]])(
      "should not let an earlier copy's delay unmark a later copy of %s",
      async (_, laterCopy) => {
        mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
        stubPrices({
          8455: buildListedPrice(buildListing(100)),
          1: buildListedPrice(buildListing(100)),
        });

        renderPage();
        await waitForItemsLoaded();
        vi.useFakeTimers();
        await copy("Augmented Wolfram Cuirass");
        act(() => {
          vi.advanceTimersByTime(1000);
        });
        await copy(laterCopy);
        act(() => {
          vi.advanceTimersByTime(500);
        });

        expect(isNameMarkedCopied(laterCopy)).toBe(true);
      },
    );

    it("should not mark the item as copied when the clipboard can't be written to", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      stubPrices({ 8455: buildListedPrice(buildListing(100)) });
      writeText.mockRejectedValue(new Error("Denied"));

      renderPage();
      await waitForItemsLoaded();
      await copy("Augmented Wolfram Cuirass");

      expect(isNameMarkedCopied("Augmented Wolfram Cuirass")).toBe(false);
    });
  });
});
