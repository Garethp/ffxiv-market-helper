// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { buildMarketPageUrl } from "../api/universalis";
import type { ScannedItem } from "../hooks/useHighVolumeItemScan";
import type { ScannedItemProfit } from "../hooks/useScannedItemProfits";
import type { BuyingRegion } from "../services/tradingConfig";
import type { ProfitRow } from "../types";
import { ScannedItemsTable } from "./ScannedItemsTable";

afterEach(cleanup);

const scannedItem = (overrides: Partial<ScannedItem> = {}): ScannedItem => ({
  itemId: 1,
  nqSaleVelocity: 10,
  hqSaleVelocity: 5,
  totalSaleVelocity: 15,
  ...overrides,
});

const buyingRegions: BuyingRegion[] = [
  { region: "Europe", characters: [{ name: "Alice" }] },
  {
    region: "Japan",
    characters: [{ name: "Bob" }],
  },
];

const renderTable = (
  items: ScannedItem[],
  itemNames: Record<number, string> = {},
  world = "Raiden",
  profits: Record<number, ScannedItemProfit> = {},
  highlightProfitPerDay?: number,
) =>
  render(
    <MemoryRouter>
      <ScannedItemsTable
        items={items}
        itemNames={itemNames}
        profits={profits}
        buyingRegions={buyingRegions}
        highlightProfitPerDay={highlightProfitPerDay}
        world={world}
      />
    </MemoryRouter>,
  );

const item = {
  itemId: 1,
  name: "Wind Cluster",
  stackSize: 1,
  targetQuantity: 99,
};

const pricedRow = (
  buyDataCenter: string,
  expectedProfitPerDay: number | null = 6000,
): ProfitRow => ({
  item,
  analysis: {
    status: "ready",
    buyDataCenter,
    buy: {
      pricePerUnit: 400,
      quantityFilled: 99,
      fullyFilled: true,
      cheapestWorld: "Omega",
    },
    sellPricePerUnit: 1000,
    sellSampleSize: 10,
    sellPriceSource: "history",
    sellPriceCapped: false,
    gapDetected: false,
    saleVelocityPerDay: 10,
    effectiveBuyPricePerUnit: 400,
    effectiveSellPricePerUnit: 1000,
    profitPerItem: 600,
    profitPerStack: 600,
    expectedProfitPerDay,
    sellListingStatus: { state: "not-listed" },
  },
  lastSuccessAt: Date.now(),
  lastAttemptFailed: false,
  lastErrorMessage: null,
});

const failedRow: ProfitRow = {
  item,
  analysis: { status: "pending" },
  lastSuccessAt: null,
  lastAttemptFailed: true,
  lastErrorMessage: "Gateway timeout",
};

const pricedProfit = (
  rowByRegion: Record<string, ProfitRow> = {
    Europe: pricedRow("Chaos"),
    Japan: pricedRow("Elemental"),
  },
): ScannedItemProfit => ({ status: "ready", rowByRegion });

/** The scanned items' own rows, not those of any profit table shown within them. */
const bodyRows = (container: HTMLElement) =>
  Array.from(
    container.querySelector("table")!.querySelectorAll(":scope > tbody > tr"),
  );

const totalCell = (row: Element) => row.querySelectorAll(":scope > td")[3];

/** The first scanned item's profit tooltip, split into its buying region sections. */
const tooltipSections = (container: HTMLElement) =>
  Array.from(
    totalCell(bodyRows(container)[0]).querySelectorAll(
      ".profit-tooltip section",
    ),
  ) as HTMLElement[];

describe("ScannedItemsTable", () => {
  describe("listing items", () => {
    it("should render one row per scanned item", () => {
      const { container } = renderTable([
        scannedItem({ itemId: 1 }),
        scannedItem({ itemId: 2 }),
        scannedItem({ itemId: 3 }),
      ]);

      expect(bodyRows(container)).toHaveLength(3);
    });

    it("should list items in the order given", () => {
      const { container } = renderTable(
        [
          scannedItem({ itemId: 3 }),
          scannedItem({ itemId: 1 }),
          scannedItem({ itemId: 2 }),
        ],
        { 1: "Wind Cluster", 2: "Caramel Popcorn", 3: "Grade 8 Dark Matter" },
      );

      expect(
        bodyRows(container).map(
          (row) => row.querySelector("td a")?.textContent,
        ),
      ).toEqual(["Grade 8 Dark Matter", "Wind Cluster", "Caramel Popcorn"]);
    });

    it("should render no rows when there are no scanned items", () => {
      const { container } = renderTable([]);

      expect(bodyRows(container)).toHaveLength(0);
    });
  });

  describe("naming items", () => {
    it("should show the item's name when it's known", () => {
      renderTable([scannedItem({ itemId: 42 })], { 42: "Grade 8 Dark Matter" });

      expect(screen.queryByText("Grade 8 Dark Matter")).not.toBeNull();
    });

    it("should fall back to the item ID when its name isn't known yet", () => {
      renderTable([scannedItem({ itemId: 42 })], {});

      expect(screen.queryByText("#42")).not.toBeNull();
    });
  });

  describe("linking out", () => {
    it("should link the item's name to its profit scan, opening in a new tab without exposing this page", () => {
      renderTable([scannedItem({ itemId: 42 })], { 42: "Grade 8 Dark Matter" });

      const link = screen.getByText("Grade 8 Dark Matter").closest("a");
      expect(link?.getAttribute("href")).toBe("/item/42");
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("should link to the item's Universalis market page for the selected world, opening in a new tab without exposing this page", () => {
      renderTable([scannedItem({ itemId: 42 })], {}, "Raiden");

      const link = screen.getByTitle("View on Universalis");
      expect(link.getAttribute("href")).toBe(buildMarketPageUrl(42, "Raiden"));
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
  });

  describe("showing sale velocity", () => {
    it("should show NQ, HQ and total units sold per day, rounded and with thousands separators", () => {
      const { container } = renderTable([
        scannedItem({
          nqSaleVelocity: 1234.4,
          hqSaleVelocity: 5678.6,
          totalSaleVelocity: 6913,
        }),
      ]);

      const cells = Array.from(bodyRows(container)[0].querySelectorAll("td"));
      expect(cells.slice(1).map((cell) => cell.textContent)).toEqual([
        (1234).toLocaleString(),
        (5679).toLocaleString(),
        (6913).toLocaleString(),
      ]);
    });
  });

  describe("showing profit", () => {
    it("should keep showing a priced item's sale velocity", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1, totalSaleVelocity: 1234 })],
        {},
        "Raiden",
        { 1: pricedProfit() },
      );

      const row = bodyRows(container)[0];
      expect(row.querySelectorAll(":scope > td")).toHaveLength(4);
      expect(totalCell(row).textContent).toContain((1234).toLocaleString());
    });

    it("should show a priced item's profit through each buying region in a tooltip on its total per day", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 })],
        {},
        "Raiden",
        { 1: pricedProfit() },
      );

      const sections = tooltipSections(container);
      expect(
        sections.map((section) => section.querySelector("h2")?.textContent),
      ).toEqual(["Buying via Alice (Europe)", "Buying via Bob (Japan)"]);
      expect(
        sections.map((section) => {
          const [, row] = within(section).getAllByRole("row");
          return row.querySelectorAll("td")[1].textContent;
        }),
      ).toEqual(["Chaos", "Elemental"]);
    });

    it("should warn about a buying region whose fetch failed", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 })],
        {},
        "Raiden",
        { 1: pricedProfit({ Europe: pricedRow("Chaos"), Japan: failedRow }) },
      );

      const [europe, japan] = tooltipSections(container);
      expect(europe.querySelector(".stale-badge")).toBeNull();
      expect(japan.querySelector(".stale-badge")).not.toBeNull();
    });

    it("should link the profit tables' sell prices to the selected world's market page", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 })],
        {},
        "Raiden",
        { 1: pricedProfit() },
      );

      const linkTargets = tooltipSections(container).flatMap((section) =>
        within(section)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      );
      expect(linkTargets).toContain(buildMarketPageUrl(1, "Raiden"));
    });

    it("should mark an item's total per day while it's being priced, without a tooltip yet", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 })],
        {},
        "Raiden",
        {
          1: { status: "loading" },
        },
      );

      const total = totalCell(bodyRows(container)[0]);
      expect(total.querySelector(".row-refreshing")).not.toBeNull();
      expect(total.querySelector(".profit-tooltip")).toBeNull();
    });

    it("should offer no tooltip or marking for an item that isn't priced", () => {
      const { container } = renderTable([scannedItem({ itemId: 1 })]);

      const total = totalCell(bodyRows(container)[0]);
      expect(total.querySelector(".row-refreshing")).toBeNull();
      expect(total.querySelector(".profit-tooltip")).toBeNull();
    });
  });

  describe("highlighting profitable items", () => {
    const isHighlighted = (row: Element) =>
      row.classList.contains("row-highlight");

    it("should highlight an item expected to make more than the highlight amount per day through any buying region", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 }), scannedItem({ itemId: 2 })],
        {},
        "Raiden",
        {
          1: pricedProfit({
            Europe: pricedRow("Chaos", 100_000),
            Japan: pricedRow("Elemental", 600_000),
          }),
          2: pricedProfit({
            Europe: pricedRow("Chaos", 100_000),
            Japan: pricedRow("Elemental", 200_000),
          }),
        },
        500_000,
      );

      expect(bodyRows(container).map(isHighlighted)).toEqual([true, false]);
    });

    it("should not highlight an item expected to make exactly the highlight amount per day", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 })],
        {},
        "Raiden",
        { 1: pricedProfit({ Europe: pricedRow("Chaos", 500_000) }) },
        500_000,
      );

      expect(isHighlighted(bodyRows(container)[0])).toBe(false);
    });

    it("should not highlight an item with no expected profit through any buying region", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 })],
        {},
        "Raiden",
        {
          1: pricedProfit({
            Europe: pricedRow("Chaos", null),
            Japan: failedRow,
          }),
        },
        0,
      );

      expect(isHighlighted(bodyRows(container)[0])).toBe(false);
    });

    it("should not highlight an item that's still being priced or isn't priced", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 }), scannedItem({ itemId: 2 })],
        {},
        "Raiden",
        { 1: { status: "loading" } },
        0,
      );

      expect(bodyRows(container).map(isHighlighted)).toEqual([false, false]);
    });

    it("should highlight nothing when there's no highlight amount", () => {
      const { container } = renderTable(
        [scannedItem({ itemId: 1 })],
        {},
        "Raiden",
        { 1: pricedProfit({ Europe: pricedRow("Chaos", 600_000) }) },
        undefined,
      );

      expect(isHighlighted(bodyRows(container)[0])).toBe(false);
    });
  });
});
