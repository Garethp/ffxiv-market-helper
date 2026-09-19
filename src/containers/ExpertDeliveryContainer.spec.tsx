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
    { wrapper: withQueryClient() },
  );

/** A cell's text as it reads, leaving out the copy button and its tooltip. */
const cellText = (cell: HTMLElement) => {
  const copy = cell.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".tooltip-anchor").forEach((anchor) => anchor.remove());
  return copy.textContent;
};

const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").map(cellText));

const tableRows = () => rowsOf(screen.getByRole("table"));

const itemNames = () => tableRows().map(([name]) => name);

const pricesGiven = (prices: Record<number, ExpertDeliveryPrice>) =>
  mockedUseExpertDeliveryPrices.mockReturnValue(prices);

const at = (pricePerUnit: number, worldName = "Zodiark"): RegionListing => ({
  pricePerUnit,
  worldName,
});

const listed = (...listings: RegionListing[]): ExpertDeliveryPrice => ({
  status: "listed",
  listings,
});

const itemsLoaded = () =>
  waitFor(() => expect(screen.queryByText("Loading items…")).toBeNull());

const setField = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const showRoute = () =>
  fireEvent.click(screen.getByRole("button", { name: "Route" }));

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pricesGiven({});
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

describe("ExpertDeliveryContainer", () => {
  describe("the items", () => {
    it("should list only items worth at least 150 seals", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([]);

      renderPage();

      await itemsLoaded();
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
      pricesGiven({ 1: listed(at(100)) });

      const { rerender } = renderPage();
      await waitFor(() =>
        expect(mockedUseExpertDeliveryPrices).toHaveBeenLastCalledWith(
          [8455, 1],
          "Europe",
        ),
      );

      expect(screen.getByText("Loading items…")).not.toBeNull();
      expect(screen.queryByRole("table")).toBeNull();

      pricesGiven({ 8455: listed(at(100)), 1: listed(at(100)) });
      rerender(
        <ExpertDeliveryContainer config={config} currentCharacter={alice} />,
      );

      expect(screen.queryByText("Loading items…")).toBeNull();
      expect(itemNames()).toEqual(["Some Sword", "Augmented Wolfram Cuirass"]);
    });

    it("should say how many items couldn't be priced, in either view", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      pricesGiven({ 8455: { status: "failed" }, 1: listed(at(100)) });

      renderPage();
      await itemsLoaded();

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
      pricesGiven({ 8455: listed(at(5000)), 1: { status: "unlisted" } });

      renderPage();
      await itemsLoaded();

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

      await itemsLoaded();
      expect(
        (screen.getByLabelText("Minimum seals / gil") as HTMLInputElement)
          .value,
      ).toBe("4");
      expect(
        (screen.getByLabelText("Maximum price") as HTMLInputElement).value,
      ).toBe("1k");
    });

    it("should leave out items with no listings worth at least the minimum seals per gil", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      // 518 / 130 is just under 4 seals per gil.
      pricesGiven({ 8455: listed(at(130)), 1: listed(at(100)) });

      renderPage();
      await itemsLoaded();

      expect(itemNames()).toEqual(["Some Sword"]);
    });

    it("should leave out items with no listings costing at most the maximum price", async () => {
      const helm: ExpertDeliveryItem = {
        itemId: 4,
        name: "Pricey Helm",
        itemLevel: 100,
        seals: 5000,
      };
      mockedGetExpertDeliveryItems.mockResolvedValue([sword, helm]);
      // Still worth plenty of seals per gil, at almost 5.
      pricesGiven({ 1: listed(at(100)), 4: listed(at(1001)) });

      renderPage();
      await itemsLoaded();

      expect(itemNames()).toEqual(["Some Sword"]);
    });

    it("should apply the limits as they're changed", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      pricesGiven({ 8455: listed(at(100)), 1: listed(at(500)) });

      renderPage();
      await itemsLoaded();
      setField("Maximum price", "200");

      expect(itemNames()).toEqual(["Augmented Wolfram Cuirass"]);

      setField("Maximum price", "");
      setField("Minimum seals / gil", "4");

      expect(itemNames()).toEqual(["Augmented Wolfram Cuirass"]);
    });

    it("should show every listed item once both limits are cleared", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      pricesGiven({ 8455: listed(at(1_000_000)), 1: listed(at(5000)) });

      renderPage();
      await itemsLoaded();
      setField("Minimum seals / gil", "");
      setField("Maximum price", "");

      expect(itemNames()).toEqual(["Some Sword", "Augmented Wolfram Cuirass"]);
    });
  });

  describe("the list", () => {
    it("should show each item at its best listing, with how many listings meet the filters and their average seals per gil", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([sword]);
      pricesGiven({
        // The last is worth too few seals per gil to count.
        1: listed(at(150, "Lich"), at(100, "Omega"), at(400), at(500)),
      });

      renderPage();
      await itemsLoaded();

      expect(columnHeaderNames(screen.getByRole("table"))).toEqual([
        "Item",
        "Lowest price",
        "Seals / gil",
        "Seals",
        "Listings",
        "Average seals / gil",
        "World",
      ]);
      expect(tableRows()).toEqual([
        ["Some Sword", "100", "18.12", "1,812", "3", "11.58", "Omega - Chaos"],
      ]);
    });

    it("should show only the world for a world that isn't in the directory", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      pricesGiven({ 8455: listed(at(100, "Brand New World")) });

      renderPage();
      await itemsLoaded();

      expect(tableRows()[0].slice(-1)).toEqual(["Brand New World"]);
    });

    it("should list items most seals per gil first", async () => {
      const shield: ExpertDeliveryItem = {
        itemId: 2,
        name: "Some Shield",
        itemLevel: 100,
        seals: 600,
      };
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, shield, sword]);
      pricesGiven({
        8455: listed(at(120, "Omega")),
        2: listed(at(100)),
        1: listed(at(100)),
      });

      renderPage();
      await itemsLoaded();

      expect(itemNames()).toEqual([
        "Some Sword",
        "Some Shield",
        "Augmented Wolfram Cuirass",
      ]);
    });

    it("should leave out items with no listings, or that couldn't be priced", async () => {
      const shield: ExpertDeliveryItem = {
        itemId: 2,
        name: "Some Shield",
        itemLevel: 100,
        seals: 600,
      };
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, shield, sword]);
      pricesGiven({
        8455: { status: "unlisted" },
        2: { status: "failed" },
        1: listed(at(100)),
      });

      renderPage();
      await itemsLoaded();

      expect(itemNames()).toEqual(["Some Sword"]);
    });
  });

  describe("the route", () => {
    const itemAt = (
      itemId: number,
      name: string,
      seals: number,
    ): ExpertDeliveryItem => ({ itemId, name, itemLevel: 100, seals });

    /** Each data center's heading, followed by the headings of the worlds in it. */
    const routeHeadings = () =>
      screen
        .getAllByRole("heading", { level: 2 })
        .concat(screen.queryAllByRole("heading", { level: 3 }))
        .sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1,
        )
        .map((heading) => heading.textContent);

    const worldTable = (world: string) =>
      within(screen.getByRole("region", { name: world })).getByRole("table");

    it("should show the list until the route is picked", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([]);

      renderPage();
      await itemsLoaded();

      const pressed = (name: string) =>
        screen.getByRole("button", { name }).getAttribute("aria-pressed");
      expect(pressed("List")).toBe("true");
      expect(pressed("Route")).toBe("false");
      showRoute();
      expect(pressed("List")).toBe("false");
      expect(pressed("Route")).toBe("true");
    });

    it("should visit the home world, then the rest of its data center, then other data centers, most seals first", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([
        itemAt(1, "On Omega", 5000),
        itemAt(2, "On Lich", 300),
        itemAt(3, "At home", 200),
        itemAt(4, "On Odin", 900),
      ]);
      pricesGiven({
        1: listed(at(100, "Omega")),
        2: listed(at(50, "Lich")),
        3: listed(at(10, "Zodiark")),
        4: listed(at(100, "Odin")),
      });

      renderPage();
      await itemsLoaded();
      showRoute();

      expect(routeHeadings()).toEqual([
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
        itemAt(1, "Sword", 900),
        itemAt(2, "Shield", 500),
      ]);
      pricesGiven({
        1: listed(at(100, "Lich"), at(120, "Omega"), at(200, "Lich")),
        2: listed(at(100, "Lich")),
      });

      renderPage();
      await itemsLoaded();
      showRoute();

      expect(columnHeaderNames(worldTable("Lich"))).toEqual([
        "Item",
        "Price",
        "Seals / gil",
        "Seals",
      ]);
      expect(rowsOf(worldTable("Lich"))).toEqual([
        ["Sword", "100", "9.00", "900"],
        ["Shield", "100", "5.00", "500"],
        ["Sword", "200", "4.50", "900"],
      ]);
      expect(rowsOf(worldTable("Omega"))).toEqual([
        ["Sword", "120", "7.50", "900"],
      ]);
      expect(
        screen.getByRole("heading", { name: "Lich 3 listings, 2,300 seals" }),
      ).not.toBeNull();
    });

    it("should leave out listings outside the limits", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([itemAt(1, "Sword", 900)]);
      pricesGiven({ 1: listed(at(100, "Lich"), at(1000, "Omega")) });

      renderPage();
      await itemsLoaded();
      showRoute();

      expect(routeHeadings()).toEqual(["Light", "Lich 1 listing, 900 seals"]);
    });

    it("should put worlds it doesn't know the data center of last", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([
        itemAt(1, "Somewhere new", 5000),
        itemAt(2, "On Omega", 300),
      ]);
      pricesGiven({
        1: listed(at(100, "Brand New World")),
        2: listed(at(50, "Omega")),
      });

      renderPage();
      await itemsLoaded();
      showRoute();

      expect(routeHeadings()).toEqual([
        "Chaos",
        "Omega 1 listing, 300 seals",
        "Unknown data center",
        "Brand New World 1 listing, 5,000 seals",
      ]);
    });

    it("should size each column the same in every world's table", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([
        itemAt(1, "A Very Long Item Name Indeed", 900),
        itemAt(2, "Short", 500),
      ]);
      pricesGiven({
        1: listed(at(100, "Lich")),
        2: listed(at(100, "Omega")),
      });

      renderPage();
      await itemsLoaded();
      showRoute();

      const widths = (world: string) =>
        Array.from(worldTable(world).querySelectorAll("col")).map(
          (col) => col.style.width,
        );
      expect(widths("Lich")).toEqual(["55%", "15%", "15%", "15%"]);
      expect(widths("Omega")).toEqual(widths("Lich"));
    });
  });

  describe("copying an item name", () => {
    const copyButtonsFor = (name: string) =>
      screen
        .getAllByRole("row")
        .filter((row) => row.textContent?.includes(name))
        .map((row) =>
          within(row).getByRole("button", { name: "Copy item name" }),
        );

    const copy = async (name: string) => {
      await act(async () => {
        fireEvent.click(copyButtonsFor(name)[0]);
      });
    };

    const isMarkedCopied = (button: HTMLElement) =>
      button.textContent?.includes("Copied!") ?? false;

    const isNameMarkedCopied = (name: string) =>
      copyButtonsFor(name).every(isMarkedCopied);

    it("should put the copy button ahead of the item's name", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      pricesGiven({ 8455: listed(at(100)) });

      renderPage();
      await itemsLoaded();

      const [nameCell] = within(screen.getByRole("table")).getAllByRole("cell");
      expect(
        nameCell.firstChild?.contains(
          copyButtonsFor("Augmented Wolfram Cuirass")[0],
        ),
      ).toBe(true);
      expect(nameCell.lastChild?.textContent).toBe("Augmented Wolfram Cuirass");
    });

    it("should copy the item's name from the list, and mark only that item as copied", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      pricesGiven({ 8455: listed(at(100)), 1: listed(at(100)) });

      renderPage();
      await itemsLoaded();
      await copy("Some Sword");

      expect(writeText).toHaveBeenCalledWith("Some Sword");
      expect(isNameMarkedCopied("Some Sword")).toBe(true);
      expect(isNameMarkedCopied("Augmented Wolfram Cuirass")).toBe(false);
    });

    it("should mark only the route listing copied from, not the item's other listings on that world or others", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
      pricesGiven({
        8455: listed(at(100, "Omega")),
        1: listed(at(100), at(100), at(100, "Omega")),
      });

      renderPage();
      await itemsLoaded();
      showRoute();
      await copy("Augmented Wolfram Cuirass");
      await copy("Some Sword");

      expect(writeText).toHaveBeenLastCalledWith("Some Sword");
      expect(copyButtonsFor("Some Sword").map(isMarkedCopied)).toEqual([
        true,
        false,
        false,
      ]);
      expect(isNameMarkedCopied("Augmented Wolfram Cuirass")).toBe(false);
    });

    it("should stop marking the item as copied after a short delay", async () => {
      mockedGetExpertDeliveryItems.mockResolvedValue([cuirass]);
      pricesGiven({ 8455: listed(at(100)) });

      renderPage();
      await itemsLoaded();
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

    it.each([
      ["another item", "Some Sword"],
      ["the same item again", "Augmented Wolfram Cuirass"],
    ])(
      "should not let an earlier copy's delay unmark a later copy of %s",
      async (_, laterCopy) => {
        mockedGetExpertDeliveryItems.mockResolvedValue([cuirass, sword]);
        pricesGiven({ 8455: listed(at(100)), 1: listed(at(100)) });

        renderPage();
        await itemsLoaded();
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
      pricesGiven({ 8455: listed(at(100)) });
      writeText.mockRejectedValue(new Error("Denied"));

      renderPage();
      await itemsLoaded();
      await copy("Augmented Wolfram Cuirass");

      expect(isNameMarkedCopied("Augmented Wolfram Cuirass")).toBe(false);
    });
  });
});
