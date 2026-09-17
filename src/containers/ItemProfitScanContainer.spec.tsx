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
import type { Character, TrackedItem, TradingParameters } from "../types";

vi.mock("../api/xivapi", () => ({ fetchItem: vi.fn() }));
vi.mock("../services/trackedItemService", () => ({
  trackedItemService: { trackItem: vi.fn() },
}));
vi.mock("../services/rowAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/rowAnalysis")>();
  return { ...actual, fetchRowMarketData: vi.fn() };
});

import { fetchItem, type ItemDetails } from "../api/xivapi";
import { trackedItemService } from "../services/trackedItemService";
import { fetchRowMarketData } from "../services/rowAnalysis";
import { columnHeaderNames } from "../testing/columnHeaderNames";
import { descriptionOf } from "../testing/descriptionOf";
import { withQueryClient } from "../testing/withQueryClient";
import { pricingHints } from "../components/pricingHints";
import { ItemProfitScanContainer } from "./ItemProfitScanContainer";

const mockedFetchItem = vi.mocked(fetchItem);
const mockedTrackItem = vi.mocked(trackedItemService.trackItem);
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

const renderItemPage = (
  itemIdSegment: string = String(itemId),
  { trackedItems = [] }: { trackedItems?: TrackedItem[] } = {},
) => {
  const onTrackedItemsChanged = vi.fn();
  render(
    <MemoryRouter initialEntries={[`/item/${itemIdSegment}`]}>
      <Routes>
        <Route path="/" element={<p>Tracked items</p>} />
        <Route
          path="/item/:itemId"
          element={
            <ItemProfitScanContainer
              config={{ ...config, trackedItems }}
              currentCharacter={alice}
              onTrackedItemsChanged={onTrackedItemsChanged}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
    { wrapper: withQueryClient() },
  );
  return onTrackedItemsChanged;
};

const regionSection = (heading: string) =>
  screen.getByRole("heading", { name: heading }).closest("section")!;

/** The item's cell under the given column, in the section buying via the given region. */
const cell = (sectionHeading: string, column: string) => {
  const section = regionSection(sectionHeading);
  const columns = columnHeaderNames(section);
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
  mockedFetchItem.mockResolvedValue(null);
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
      const details = deferred<ItemDetails | null>();
      mockedFetchItem.mockReturnValue(details.promise);

      renderItemPage();

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Item #42",
      );
      await waitFor(() => expect(document.title).toBe("Item #42"));

      details.resolve({ name: "Grade 8 Dark Matter", stackSize: 999 });

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
          descriptionOf(cell(europe, "Item").querySelector(".stale-badge")),
        ).toBe(
          "Data has never loaded successfully. Latest fetch failed: Gateway timeout",
        ),
      );
    });
  });

  describe("adjusting how the item is priced", () => {
    it.each([
      ["target qty", pricingHints.targetQuantity],
      ["sell ceiling", pricingHints.sellPriceCeiling],
    ])("should explain what the %s means", (setting, explanation) => {
      renderItemPage();

      const hint = screen.getByRole("button", { name: `About ${setting}` });
      expect(
        document.getElementById(hint.getAttribute("aria-describedby") ?? "")
          ?.textContent,
      ).toBe(explanation);
    });

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
      expect(cell(europe, "Sell price").textContent).toBe("800");

      fireEvent.change(sellCeiling, { target: { value: "" } });
      expect(cell(europe, "Sell price").textContent).toBe("1,000");
    });
  });

  describe("tracking the item", () => {
    const darkMatter: ItemDetails = {
      name: "Grade 8 Dark Matter",
      stackSize: 999,
    };

    beforeEach(() => {
      mockedFetchItem.mockResolvedValue(darkMatter);
      mockedTrackItem.mockResolvedValue({ ok: true });
    });

    it("should track the item by its name and stack size, with the quality, target quantity and sell price ceiling entered", async () => {
      const onTrackedItemsChanged = renderItemPage();
      fireEvent.click(screen.getByRole("checkbox", { name: "HQ" }));
      fireEvent.change(screen.getByLabelText("Target qty"), {
        target: { value: "60" },
      });
      fireEvent.change(screen.getByLabelText("Sell ceiling"), {
        target: { value: "5000" },
      });

      fireEvent.click(
        await screen.findByRole("button", { name: "Track this item" }),
      );

      expect(mockedTrackItem).toHaveBeenCalledWith({
        itemId,
        name: "Grade 8 Dark Matter",
        stackSize: 999,
        hq: true,
        targetQuantity: 60,
        sellPriceCeiling: 5000,
      });
      await waitFor(() => expect(onTrackedItemsChanged).toHaveBeenCalled());
    });

    it("should only offer to track the item once its name and stack size are known", async () => {
      const details = deferred<ItemDetails | null>();
      mockedFetchItem.mockReturnValue(details.promise);
      renderItemPage();

      expect(
        screen.queryByRole("button", { name: "Track this item" }),
      ).toBeNull();

      details.resolve(darkMatter);
      await screen.findByRole("button", { name: "Track this item" });
    });

    it.each([
      ["can't be found", () => mockedFetchItem.mockResolvedValue(null)],
      [
        "can't be fetched",
        () => mockedFetchItem.mockRejectedValue(new Error("XIVAPI is down")),
      ],
    ])(
      "should not offer to track the item when its details %s",
      async (_, setUpDetails) => {
        setUpDetails();
        renderItemPage();
        await priced();

        expect(
          screen.queryByRole("button", { name: "Track this item" }),
        ).toBeNull();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
          "Item #42",
        );
      },
    );

    it("should show when the item is already tracked as HQ once HQ is ticked", async () => {
      renderItemPage(String(itemId), {
        trackedItems: [
          {
            id: "dark-matter",
            itemId,
            ...darkMatter,
            hq: true,
            targetQuantity: 99,
          },
        ],
      });
      await screen.findByRole("button", { name: "Track this item" });

      fireEvent.click(screen.getByRole("checkbox", { name: "HQ" }));

      expect(screen.getByText("Tracked as HQ")).toBeTruthy();
    });

    it("should no longer explain an earlier refusal once the item is tracked", async () => {
      mockedTrackItem
        .mockResolvedValueOnce({
          ok: false,
          error: { reason: "invalid-sell-price-ceiling" },
        })
        .mockResolvedValueOnce({ ok: true });
      renderItemPage();
      const trackButton = await screen.findByRole("button", {
        name: "Track this item",
      });
      fireEvent.click(trackButton);
      await screen.findByRole("alert");

      fireEvent.click(trackButton);

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });

    it("should show when the item is already tracked with the chosen quality", async () => {
      renderItemPage(String(itemId), {
        trackedItems: [
          { id: "dark-matter", itemId, ...darkMatter, targetQuantity: 99 },
        ],
      });

      await screen.findByText("Tracked as NQ");
      expect(
        screen.queryByRole("button", { name: "Track this item" }),
      ).toBeNull();

      fireEvent.click(screen.getByRole("checkbox", { name: "HQ" }));
      await screen.findByRole("button", { name: "Track this item" });
    });

    it("should explain why the item couldn't be tracked", async () => {
      mockedTrackItem.mockResolvedValue({
        ok: false,
        error: {
          reason: "already-tracked",
          name: "Grade 8 Dark Matter",
          hq: false,
        },
      });
      const onTrackedItemsChanged = renderItemPage();

      fireEvent.click(
        await screen.findByRole("button", { name: "Track this item" }),
      );

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Grade 8 Dark Matter is already tracked as NQ.",
      );
      expect(onTrackedItemsChanged).not.toHaveBeenCalled();
    });
  });
});
