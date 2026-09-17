// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UniversalisMarketData } from "../api/universalis";
import type { RowMarketData } from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, TradingParameters } from "../types";

vi.mock("../api/xivapi", () => ({ fetchItemNames: vi.fn() }));
vi.mock("../services/rowAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/rowAnalysis")>();
  return { ...actual, fetchRowMarketData: vi.fn() };
});

import { fetchItemNames } from "../api/xivapi";
import { fetchRowMarketData } from "../services/rowAnalysis";
import { withQueryClient } from "../testing/withQueryClient";
import { ItemProfitScanContainer } from "./ItemProfitScanContainer";

const mockedFetchItemNames = vi.mocked(fetchItemNames);
const mockedFetchRowMarketData = vi.mocked(fetchRowMarketData);

/** A promise whose resolution is controlled from outside. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const itemId = 42;

const alice: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "Raiden",
  retainers: [],
};

const config: TradingConfig = {
  trackedItems: [],
  characters: [alice],
  regions: [],
  params: {
    buyTaxRate: 0,
    defaultSellTaxRate: 0,
    gapThresholdMultiplier: 1.1,
    saleSampleSize: 3,
    undercutListingThreshold: 5,
  } as TradingParameters,
  marketBoardCities: [],
  buyingRegions: [
    { region: "Europe", characters: [{ id: "alice", name: "Alice" }] },
    { region: "North America", characters: [{ id: "bob", name: "Bob" }] },
  ],
  ownRetainers: [],
};

const sale = (pricePerUnit: number, hq: boolean) => ({
  pricePerUnit,
  quantity: 1,
  timestamp: 0,
  hq,
});

const listing = (pricePerUnit: number, quantity: number) => ({
  pricePerUnit,
  quantity,
  hq: false,
  retainerName: "Someone Else",
});

const marketData = (
  data: Partial<UniversalisMarketData>,
): UniversalisMarketData => ({
  itemID: itemId,
  listings: [],
  recentHistory: [],
  nqSaleVelocity: 0,
  hqSaleVelocity: 0,
  ...data,
});

/** NQ sells for 1,000 and HQ for 2,000 on the sell world. */
const sellMarketData = marketData({
  recentHistory: [
    sale(1000, false),
    sale(1000, false),
    sale(1000, false),
    sale(2000, true),
    sale(2000, true),
    sale(2000, true),
  ],
});

/** NQ can be bought in Europe at 400 (10 available) or 600 (100 available). */
const europeMarketData: RowMarketData = {
  sell: sellMarketData,
  sellTaxRates: {},
  buy: [
    {
      dataCenter: "Light",
      data: marketData({ listings: [listing(400, 10), listing(600, 100)] }),
    },
  ],
};

/** NQ can be bought in North America at 300 (500 available). */
const northAmericaMarketData: RowMarketData = {
  sell: sellMarketData,
  sellTaxRates: {},
  buy: [
    {
      dataCenter: "Aether",
      data: marketData({ listings: [listing(300, 500)] }),
    },
  ],
};

const renderItemPage = (itemIdSegment: string = String(itemId)) =>
  render(
    <MemoryRouter initialEntries={[`/item/${itemIdSegment}`]}>
      <Routes>
        <Route path="/" element={<p>Tracked items</p>} />
        <Route
          path="/item/:itemId"
          element={
            <ItemProfitScanContainer config={config} currentCharacter={alice} />
          }
        />
      </Routes>
    </MemoryRouter>,
    { wrapper: withQueryClient() },
  );

const regionSection = (heading: string) =>
  screen.getByRole("heading", { name: heading }).closest("section")!;

/** The item's cell under the given column, in the section buying via the given region. */
const cell = (sectionHeading: string, column: string) => {
  const section = regionSection(sectionHeading);
  const columns = within(section)
    .getAllByRole("columnheader")
    .map((header) => header.textContent);
  const [itemRow] = within(section).getAllByRole("row").slice(1);
  return within(itemRow).getAllByRole("cell")[columns.indexOf(column)];
};

const europe = "Buying via Alice (Europe)";
const northAmerica = "Buying via Bob (North America)";

/** Waits for the Europe row to finish pricing. */
const priced = () =>
  waitFor(() =>
    expect(cell(europe, "Buy price / unit").textContent).not.toBe("—"),
  );

beforeEach(() => {
  mockedFetchItemNames.mockResolvedValue(new Map());
  mockedFetchRowMarketData.mockImplementation(async (_client, _item, region) =>
    region === "Europe" ? europeMarketData : northAmericaMarketData,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ItemProfitScanContainer", () => {
  describe("opening an item", () => {
    it.each(["abc", "42abc", "-42", "4.2"])(
      "should go back to the tracked items page when the address names the item as %j",
      async (itemIdSegment) => {
        renderItemPage(itemIdSegment);

        expect(screen.getByText("Tracked items")).toBeTruthy();
        expect(mockedFetchRowMarketData).not.toHaveBeenCalled();
      },
    );
  });

  describe("naming the item", () => {
    it("should call the item by its number until its name is known, then by its name", async () => {
      const names = deferred<Map<number, string>>();
      mockedFetchItemNames.mockReturnValue(names.promise);

      renderItemPage();

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Item #42",
      );
      await waitFor(() => expect(document.title).toBe("Item #42"));

      names.resolve(new Map([[itemId, "Grade 8 Dark Matter"]]));

      await waitFor(() =>
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
          "Grade 8 Dark Matter",
        ),
      );
      expect(document.title).toBe("Grade 8 Dark Matter");
    });
  });

  describe("pricing across buying regions", () => {
    it("should price the item separately for each buying region", async () => {
      renderItemPage();

      await waitFor(() => {
        expect(cell(europe, "Buy DC").textContent).toBe("Light");
        expect(cell(northAmerica, "Buy DC").textContent).toBe("Aether");
      });
      expect(cell(europe, "Item").textContent).toContain("Item #42");
      expect(cell(northAmerica, "Buy price / unit").textContent).toBe("300");
    });

    it("should link the sell price to the Current Character's home world market", async () => {
      renderItemPage();
      await priced();

      const sellPriceLink = within(cell(europe, "Sell price")).getByRole(
        "link",
      );

      expect(sellPriceLink.getAttribute("href")).toContain(
        `/market/${itemId}?server=Raiden`,
      );
    });

    it("should flag a region's pricing as possibly out of date as soon as its fetch fails", async () => {
      mockedFetchRowMarketData.mockImplementation(
        async (_client, _item, region) => {
          if (region === "Europe") throw new Error("Gateway timeout");
          return northAmericaMarketData;
        },
      );

      renderItemPage();

      await waitFor(() =>
        expect(
          within(cell(europe, "Item")).getByTitle(
            "Data has never loaded successfully. Latest fetch failed: Gateway timeout",
          ),
        ).toBeTruthy(),
      );
    });
  });

  describe("adjusting how the item is priced", () => {
    it("should price as high quality once HQ is ticked", async () => {
      renderItemPage();
      await priced();
      expect(cell(europe, "Sell price").textContent).toBe("1,000");

      fireEvent.click(screen.getByRole("checkbox", { name: "HQ" }));

      expect(cell(europe, "Sell price").textContent).toBe("2,000");
    });

    it("should price buying 99 of the item until the target quantity is changed", async () => {
      renderItemPage();
      await priced();
      // 10 at 400 and 89 at 600.
      expect(cell(europe, "Buy price / unit").textContent).toBe("580");

      fireEvent.change(screen.getByLabelText("Target qty"), {
        target: { value: "10" },
      });

      expect(cell(europe, "Buy price / unit").textContent).toBe("400");
    });

    it("should price buying a single unit while the target quantity is cleared", async () => {
      renderItemPage();
      await priced();
      fireEvent.change(screen.getByLabelText("Target qty"), {
        target: { value: "20" },
      });
      expect(cell(europe, "Buy price / unit").textContent).toBe("500");

      fireEvent.change(screen.getByLabelText("Target qty"), {
        target: { value: "" },
      });

      expect(cell(europe, "Buy price / unit").textContent).toBe("400");
    });

    it("should cap the sell price at the sell price ceiling until the ceiling is cleared", async () => {
      renderItemPage();
      await priced();
      const sellCeiling = screen.getByLabelText("Sell ceiling");

      fireEvent.change(sellCeiling, { target: { value: "800" } });
      expect(cell(europe, "Sell price").textContent).toBe("800 (capped)");

      fireEvent.change(sellCeiling, { target: { value: "" } });
      expect(cell(europe, "Sell price").textContent).toBe("1,000");
    });
  });
});
