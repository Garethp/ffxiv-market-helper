// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The item tooltip looks up what an item is; these tests are only about the table around it.
vi.mock("../services/itemService", () => ({
  itemService: { getItemSummaries: async () => new Map() },
}));
import { buildMarketPageUrl } from "../api/universalis";
import type { ScannedItem } from "../hooks/useHighVolumeItemScan";
import type { ScannedItemProfit } from "../hooks/useScannedItemProfits";
import type { BuyingRegion } from "../services/tradingConfig";
import type { ProfitRow } from "../types";
import { ScannedItemsTable } from "./ScannedItemsTable";
import { createQueryClientWrapper } from "../testing/createQueryClientWrapper";

const buildScannedItem = (
  overrides: Partial<ScannedItem> = {},
): ScannedItem => ({
  itemId: 1,
  name: undefined,
  nqSaleVelocity: 10,
  hqSaleVelocity: 5,
  totalSaleVelocity: 15,
  ...overrides,
});

const buyingRegions: BuyingRegion[] = [
  { region: "Europe", characters: [{ id: "alice", name: "Alice" }] },
  {
    region: "Japan",
    characters: [{ id: "bob", name: "Bob" }],
  },
];

const renderTable = (
  items: ScannedItem[],
  world = "Raiden",
  profits: Record<number, ScannedItemProfit> = {},
  highlightProfitPerDay?: number,
) =>
  render(
    <ScannedItemsTable
      items={items}
      profits={profits}
      buyingRegions={buyingRegions}
      highlightProfitPerDay={highlightProfitPerDay}
      world={world}
      gapThresholdMultiplier={1.1}
    />,
    { wrapper: createQueryClientWrapper() },
  );

const item = {
  itemId: 1,
  name: "Wind Cluster",
  stackSize: 1,
  targetQuantity: 99,
};

const buildPricedRow = (
  buyDataCenter: string,
  expectedProfitPerDay?: number,
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
});

/** A buying region the item has no price through yet. */
const unpricedRow: ProfitRow = { item, analysis: { status: "pending" } };

const buildPricedProfit = (
  rowByRegion: Record<string, ProfitRow> = {
    Europe: buildPricedRow("Chaos", 6000),
    Japan: buildPricedRow("Elemental", 6000),
  },
): ScannedItemProfit => ({ status: "ready", rowByRegion });

/** The scanned items' own rows, not those of any profit table shown within them. */
const getBodyRows = (container: HTMLElement) =>
  Array.from(
    container.querySelector("table")!.querySelectorAll(":scope > tbody > tr"),
  );

const getTotalCell = (row: Element) => row.querySelectorAll(":scope > td")[3];

/** The first scanned item's profit tooltip, split into its buying region sections. */
const getTooltipSections = (container: HTMLElement) =>
  Array.from(
    getTotalCell(getBodyRows(container)[0]).querySelectorAll(
      ".profit-tooltip section",
    ),
  ) as HTMLElement[];

describe("ScannedItemsTable", () => {
  afterEach(() => {
    cleanup();
  });

  describe("listing items", () => {
    it("should render one row per scanned item", () => {
      const { container } = renderTable([
        buildScannedItem({ itemId: 1 }),
        buildScannedItem({ itemId: 2 }),
        buildScannedItem({ itemId: 3 }),
      ]);

      expect(getBodyRows(container)).toHaveLength(3);
    });
  });

  describe("naming items", () => {
    it("should show the item's name when it's known", () => {
      renderTable([
        buildScannedItem({ itemId: 42, name: "Grade 8 Dark Matter" }),
      ]);

      expect(screen.queryByText("Grade 8 Dark Matter")).not.toBeNull();
    });

    it("should fall back to the item ID when its name isn't known", () => {
      renderTable([buildScannedItem({ itemId: 42, name: undefined })]);

      expect(screen.queryByText("#42")).not.toBeNull();
    });
  });

  describe("linking out", () => {
    it("should link to the item's Universalis market page for the selected world, opening in a new tab without exposing this page", () => {
      renderTable([buildScannedItem({ itemId: 42 })], "Raiden");

      const link = screen.getByRole("link", { name: "View on Universalis" });
      expect(link.getAttribute("href")).toBe(buildMarketPageUrl(42, "Raiden"));
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
  });

  describe("showing sale velocity", () => {
    it("should show NQ, HQ and total units sold per day, rounded and with thousands separators", () => {
      const { container } = renderTable([
        buildScannedItem({
          nqSaleVelocity: 1234.4,
          hqSaleVelocity: 5678.6,
          totalSaleVelocity: 6913,
        }),
      ]);

      const cells = Array.from(
        getBodyRows(container)[0].querySelectorAll("td"),
      );
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
        [buildScannedItem({ itemId: 1, totalSaleVelocity: 1234 })],
        "Raiden",
        { 1: buildPricedProfit() },
      );

      const row = getBodyRows(container)[0];
      expect(row.querySelectorAll(":scope > td")).toHaveLength(4);
      expect(getTotalCell(row).textContent).toContain((1234).toLocaleString());
    });

    it("should show a priced item's profit through each buying region in a tooltip on its total per day", () => {
      const { container } = renderTable(
        [buildScannedItem({ itemId: 1 })],
        "Raiden",
        { 1: buildPricedProfit() },
      );

      const sections = getTooltipSections(container);
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

    it("should link the profit tables' sell prices to the selected world's market page", () => {
      const { container } = renderTable(
        [buildScannedItem({ itemId: 1 })],
        "Raiden",
        { 1: buildPricedProfit() },
      );

      const linkTargets = getTooltipSections(container).flatMap((section) =>
        within(section)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      );
      expect(linkTargets).toContain(buildMarketPageUrl(1, "Raiden"));
    });

    it("should mark an item's total per day while it's being priced, without a tooltip yet", () => {
      const { container } = renderTable(
        [buildScannedItem({ itemId: 1 })],
        "Raiden",
        {
          1: { status: "loading" },
        },
      );

      const total = getTotalCell(getBodyRows(container)[0]);
      expect(total.querySelector(".row-refreshing")).not.toBeNull();
      expect(total.querySelector(".profit-tooltip")).toBeNull();
    });

    it("should offer no tooltip or marking for an item that isn't priced", () => {
      const { container } = renderTable([buildScannedItem({ itemId: 1 })]);

      const total = getTotalCell(getBodyRows(container)[0]);
      expect(total.querySelector(".row-refreshing")).toBeNull();
      expect(total.querySelector(".profit-tooltip")).toBeNull();
    });
  });

  describe("highlighting profitable items", () => {
    const isHighlighted = (row: Element) =>
      row.classList.contains("row-highlight");

    it("should highlight an item expected to make more than the highlight amount per day through any buying region", () => {
      const { container } = renderTable(
        [buildScannedItem({ itemId: 1 }), buildScannedItem({ itemId: 2 })],
        "Raiden",
        {
          1: buildPricedProfit({
            Europe: buildPricedRow("Chaos", 100_000),
            Japan: buildPricedRow("Elemental", 600_000),
          }),
          2: buildPricedProfit({
            Europe: buildPricedRow("Chaos", 100_000),
            Japan: buildPricedRow("Elemental", 200_000),
          }),
        },
        500_000,
      );

      expect(getBodyRows(container).map(isHighlighted)).toEqual([true, false]);
    });

    it("should not highlight an item expected to make exactly the highlight amount per day", () => {
      const { container } = renderTable(
        [buildScannedItem({ itemId: 1 })],
        "Raiden",
        { 1: buildPricedProfit({ Europe: buildPricedRow("Chaos", 500_000) }) },
        500_000,
      );

      expect(isHighlighted(getBodyRows(container)[0])).toBe(false);
    });

    it("should not highlight an item with no expected profit through any buying region", () => {
      const { container } = renderTable(
        [buildScannedItem({ itemId: 1 })],
        "Raiden",
        {
          1: buildPricedProfit({
            Europe: buildPricedRow("Chaos"),
            Japan: unpricedRow,
          }),
        },
        0,
      );

      expect(isHighlighted(getBodyRows(container)[0])).toBe(false);
    });

    it("should not highlight an item that's still being priced or isn't priced", () => {
      const { container } = renderTable(
        [buildScannedItem({ itemId: 1 }), buildScannedItem({ itemId: 2 })],
        "Raiden",
        { 1: { status: "loading" } },
        0,
      );

      expect(getBodyRows(container).map(isHighlighted)).toEqual([false, false]);
    });

    it("should highlight nothing when there's no highlight amount", () => {
      const { container } = renderTable(
        [buildScannedItem({ itemId: 1 })],
        "Raiden",
        { 1: buildPricedProfit({ Europe: buildPricedRow("Chaos", 600_000) }) },
        undefined,
      );

      expect(isHighlighted(getBodyRows(container)[0])).toBe(false);
    });
  });
});
