// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { descriptionOf } from "../testing/descriptionOf";
import type { ProfitPricing, ProfitRow, PricedItem } from "../types";
import { ProfitTableRow } from "./ProfitTableRow";
import { withQueryClient } from "../testing/withQueryClient";

const NOW = new Date("2026-01-01T12:00:00Z").getTime();

const item: PricedItem = {
  itemId: 42,
  name: "Wind Cluster",
  stackSize: 99,
  targetQuantity: 297,
};

const readyRow = (
  pricingOverrides: Partial<ProfitPricing> = {},
  rowOverrides: Partial<ProfitRow> = {},
): ProfitRow => ({
  item,
  analysis: {
    status: "ready",
    buyDataCenter: "Chaos",
    buy: {
      pricePerUnit: 100,
      quantityFilled: 297,
      fullyFilled: true,
      cheapestWorld: "Omega",
    },
    sellPricePerUnit: 250,
    sellSampleSize: 10,
    sellPriceSource: "history",
    sellPriceCapped: false,
    gapDetected: false,
    saleVelocityPerDay: 12.34,
    effectiveBuyPricePerUnit: 105,
    effectiveSellPricePerUnit: 237.5,
    profitPerItem: 132,
    profitPerStack: 13_068,
    expectedProfitPerDay: 500,
    sellListingStatus: { state: "not-listed" },
    ...pricingOverrides,
  },
  lastSuccessAt: NOW,
  lastAttemptFailed: false,
  lastErrorMessage: null,
  ...rowOverrides,
});

const pendingRow = (rowOverrides: Partial<ProfitRow> = {}): ProfitRow => ({
  item,
  analysis: { status: "pending" },
  lastSuccessAt: null,
  lastAttemptFailed: false,
  lastErrorMessage: null,
  ...rowOverrides,
});

/** The element showing a cell's figure, which carries the tooltip explaining it. */
const figureElementIn = (cell: HTMLTableCellElement) =>
  cell.querySelector("[aria-describedby]");

const figureIn = (cell: HTMLTableCellElement) =>
  figureElementIn(cell)?.textContent ?? cell.textContent;

const renderRow = (
  row: ProfitRow,
  {
    isRefreshing = false,
    staleWarningThresholdMs = 60_000,
    sellWorld = "Raiden",
    isCopied = false,
    onCopyName = () => {},
  }: {
    isRefreshing?: boolean;
    staleWarningThresholdMs?: number | null;
    sellWorld?: string;
    isCopied?: boolean;
    onCopyName?: () => void;
  } = {},
) => {
  const { container } = render(
    <table>
      <tbody>
        <ProfitTableRow
          displayRow={{ row, isRefreshing }}
          staleWarningThresholdMs={staleWarningThresholdMs}
          sellWorld={sellWorld}
          isCopied={isCopied}
          onCopyName={onCopyName}
        />
      </tbody>
    </table>,
    { wrapper: withQueryClient() },
  );
  const tr = container.querySelector("tbody > tr") as HTMLTableRowElement;
  const cells = Array.from(tr.children) as HTMLTableCellElement[];
  return {
    tr,
    itemCell: cells[0],
    buyDataCenterCell: cells[1],
    buyPriceCell: cells[2],
    sellPriceCell: cells[3],
    profitPerItemCell: cells[4],
    profitPerStackCell: cells[5],
    expectedProfitPerDayCell: cells[6],
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ProfitTableRow", () => {
  describe("identifying the item", () => {
    it("should show the item's name", () => {
      const { itemCell } = renderRow(readyRow());

      expect(itemCell.textContent).toContain("Wind Cluster");
    });

    it("should ask to copy the item's name when the copy button is clicked", () => {
      const onCopyName = vi.fn();
      const { itemCell } = renderRow(readyRow(), { onCopyName });

      fireEvent.click(itemCell.querySelector("button")!);

      expect(onCopyName).toHaveBeenCalledTimes(1);
    });

    it("should confirm the name was copied when it has just been copied", () => {
      const { itemCell } = renderRow(readyRow(), { isCopied: true });

      expect(itemCell.querySelector(".copy-tooltip")?.textContent).toBe(
        "Copied!",
      );
    });

    it("should not confirm a copy when the name hasn't just been copied", () => {
      const { itemCell } = renderRow(readyRow(), { isCopied: false });

      expect(itemCell.querySelector(".copy-tooltip")).toBeNull();
    });

    it("should label an item priced as high quality", () => {
      const { itemCell } = renderRow(
        readyRow({}, { item: { ...item, hq: true } }),
      );

      expect(itemCell.querySelector(".quality-badge")?.textContent).toBe("HQ");
    });

    it("should explain the high quality label, reachable without a pointer", () => {
      const { itemCell } = renderRow(
        readyRow({}, { item: { ...item, hq: true } }),
      );

      const badge = itemCell.querySelector(".quality-badge");
      expect(descriptionOf(badge)).toBe("Priced as high quality");
      expect(badge?.getAttribute("tabindex")).toBe("0");
    });

    it("should not label an item priced as normal quality", () => {
      const { itemCell } = renderRow(readyRow());

      expect(itemCell.querySelector(".quality-badge")).toBeNull();
    });
  });

  describe("warning about stale data", () => {
    it("should warn when fetches have been failing for longer than the threshold", () => {
      const { itemCell } = renderRow(
        readyRow(
          {},
          { lastSuccessAt: NOW - 5 * 60_000, lastAttemptFailed: true },
        ),
        { staleWarningThresholdMs: 60_000 },
      );

      expect(itemCell.querySelector(".stale-badge")).not.toBeNull();
    });

    it("should warn when data has never loaded and the latest fetch failed", () => {
      const { itemCell } = renderRow(
        pendingRow({ lastSuccessAt: null, lastAttemptFailed: true }),
      );

      expect(itemCell.querySelector(".stale-badge")).not.toBeNull();
    });

    it("should not warn when the latest fetch failed but the last good data is still within the threshold", () => {
      const { itemCell } = renderRow(
        readyRow({}, { lastSuccessAt: NOW - 30_000, lastAttemptFailed: true }),
        { staleWarningThresholdMs: 60_000 },
      );

      expect(itemCell.querySelector(".stale-badge")).toBeNull();
    });

    it("should not warn when the last good data is exactly as old as the threshold", () => {
      const { itemCell } = renderRow(
        readyRow({}, { lastSuccessAt: NOW - 60_000, lastAttemptFailed: true }),
        { staleWarningThresholdMs: 60_000 },
      );

      expect(itemCell.querySelector(".stale-badge")).toBeNull();
    });

    it("should warn about a failed fetch as soon as any time has passed when the threshold is zero", () => {
      const { itemCell } = renderRow(
        readyRow({}, { lastSuccessAt: NOW - 1, lastAttemptFailed: true }),
        { staleWarningThresholdMs: 0 },
      );

      expect(itemCell.querySelector(".stale-badge")).not.toBeNull();
    });

    it("should not warn when there is no stale threshold", () => {
      const { itemCell } = renderRow(
        readyRow(
          {},
          { lastSuccessAt: NOW - 60 * 60_000, lastAttemptFailed: true },
        ),
        { staleWarningThresholdMs: null },
      );

      expect(itemCell.querySelector(".stale-badge")).toBeNull();
    });

    it("should not warn when the latest fetch succeeded, however old the data is", () => {
      const { itemCell } = renderRow(
        readyRow(
          {},
          { lastSuccessAt: NOW - 60 * 60_000, lastAttemptFailed: false },
        ),
        { staleWarningThresholdMs: 60_000 },
      );

      expect(itemCell.querySelector(".stale-badge")).toBeNull();
    });

    it("should explain that data has never loaded", () => {
      const { itemCell } = renderRow(
        pendingRow({ lastSuccessAt: null, lastAttemptFailed: true }),
      );

      expect(descriptionOf(itemCell.querySelector(".stale-badge"))).toBe(
        "Data has never loaded successfully",
      );
    });

    it("should say how long ago the last good data was", () => {
      const { itemCell } = renderRow(
        readyRow(
          {},
          { lastSuccessAt: NOW - 5 * 60_000, lastAttemptFailed: true },
        ),
      );

      expect(descriptionOf(itemCell.querySelector(".stale-badge"))).toBe(
        "Last good data from 5m ago",
      );
    });

    it("should round how long ago the last good data was to the nearest minute", () => {
      const { itemCell } = renderRow(
        readyRow({}, { lastSuccessAt: NOW - 90_000, lastAttemptFailed: true }),
      );

      expect(descriptionOf(itemCell.querySelector(".stale-badge"))).toBe(
        "Last good data from 2m ago",
      );
    });

    it("should include the latest fetch error when data has never loaded", () => {
      const { itemCell } = renderRow(
        pendingRow({
          lastSuccessAt: null,
          lastAttemptFailed: true,
          lastErrorMessage: "Failed to fetch",
        }),
      );

      expect(descriptionOf(itemCell.querySelector(".stale-badge"))).toBe(
        "Data has never loaded successfully. Latest fetch failed: Failed to fetch",
      );
    });

    it("should include the latest fetch error when there is one", () => {
      const { itemCell } = renderRow(
        readyRow(
          {},
          {
            lastSuccessAt: NOW - 5 * 60_000,
            lastAttemptFailed: true,
            lastErrorMessage: "Failed to fetch",
          },
        ),
      );

      expect(descriptionOf(itemCell.querySelector(".stale-badge"))).toBe(
        "Last good data from 5m ago. Latest fetch failed: Failed to fetch",
      );
    });
  });

  describe("highlighting the row", () => {
    it("should flag a supply gap on both the item and the row", () => {
      const { tr, itemCell } = renderRow(readyRow({ gapDetected: true }));

      expect(itemCell.querySelector(".gap-badge")?.textContent).toBe("gap");
      expect(tr.classList.contains("row-gap")).toBe(true);
    });

    it("should explain the supply gap, reachable without a pointer", () => {
      const { itemCell } = renderRow(readyRow({ gapDetected: true }));

      const badge = itemCell.querySelector(".gap-badge");
      expect(descriptionOf(badge)).toBe(
        "Current listings are well above recent sale prices — room to undercut",
      );
      expect(badge?.getAttribute("tabindex")).toBe("0");
    });

    it("should not flag a supply gap when none was detected", () => {
      const { tr, itemCell } = renderRow(readyRow({ gapDetected: false }));

      expect(itemCell.querySelector(".gap-badge")).toBeNull();
      expect(tr.classList.contains("row-gap")).toBe(false);
    });

    it("should mark the row while it's refreshing", () => {
      const { tr } = renderRow(readyRow(), { isRefreshing: true });

      expect(tr.classList.contains("row-refreshing")).toBe(true);
    });

    it("should flag a supply gap and mark the row as refreshing at the same time", () => {
      const { tr } = renderRow(readyRow({ gapDetected: true }), {
        isRefreshing: true,
      });

      expect(tr.classList.contains("row-gap")).toBe(true);
      expect(tr.classList.contains("row-refreshing")).toBe(true);
    });

    it("should not mark the row when it isn't refreshing", () => {
      const { tr } = renderRow(readyRow(), { isRefreshing: false });

      expect(tr.classList.contains("row-refreshing")).toBe(false);
    });
  });

  describe("showing where and for how much to buy", () => {
    it("should link the buy data center to its market page", () => {
      const { buyDataCenterCell } = renderRow(
        readyRow({ buyDataCenter: "Chaos" }),
      );

      const link = buyDataCenterCell.querySelector("a");
      expect(link?.textContent).toBe("Chaos");
      expect(link?.getAttribute("href")).toBe(
        "https://universalis.app/market/42?server=Chaos",
      );
    });

    it("should open the buy data center's market page in a new tab without exposing this page", () => {
      const { buyDataCenterCell } = renderRow(readyRow());

      const link = buyDataCenterCell.querySelector("a");
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("should show a dash for the data center when there's nothing to buy", () => {
      const { buyDataCenterCell } = renderRow(readyRow({ buy: null }));

      expect(buyDataCenterCell.querySelector("a")).toBeNull();
      expect(buyDataCenterCell.textContent).toBe("—");
    });

    it("should show the buy price per unit, rounded", () => {
      const { buyPriceCell } = renderRow(
        readyRow({
          buy: {
            pricePerUnit: 1234.4,
            quantityFilled: 297,
            fullyFilled: true,
            cheapestWorld: "Omega",
          },
        }),
      );

      expect(buyPriceCell.textContent).toBe((1234).toLocaleString());
    });
  });

  describe("showing the sell price", () => {
    it("should link the sell price to the sell world's market page", () => {
      const { sellPriceCell } = renderRow(readyRow({ sellPricePerUnit: 250 }), {
        sellWorld: "Raiden",
      });

      const link = sellPriceCell.querySelector("a");
      expect(link?.textContent).toBe((250).toLocaleString());
      expect(link?.getAttribute("href")).toBe(
        "https://universalis.app/market/42?server=Raiden",
      );
    });

    it("should open the sell world's market page in a new tab without exposing this page", () => {
      const { sellPriceCell } = renderRow(readyRow(), { sellWorld: "Raiden" });

      const link = sellPriceCell.querySelector("a");
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("should show the sell price without a link when there's no sell world", () => {
      const { sellPriceCell } = renderRow(readyRow({ sellPricePerUnit: 250 }), {
        sellWorld: "",
      });

      expect(sellPriceCell.querySelector("a")).toBeNull();
      expect(sellPriceCell.textContent).toBe((250).toLocaleString());
    });

    it.each([1, 2])(
      "should note a thin sample size of %i",
      (sellSampleSize) => {
        const { sellPriceCell } = renderRow(readyRow({ sellSampleSize }));

        expect(sellPriceCell.textContent).toContain(` (n=${sellSampleSize})`);
      },
    );

    it.each([0, 3])(
      "should not note the sample size when it is %i",
      (sellSampleSize) => {
        const { sellPriceCell } = renderRow(readyRow({ sellSampleSize }));

        expect(sellPriceCell.textContent).not.toContain("(n=");
      },
    );

    it("should note only the thin sample size, whatever else applies to the sell price", () => {
      const { sellPriceCell } = renderRow(
        readyRow({
          sellPricePerUnit: 250,
          sellPriceSource: "listings",
          sellPriceCapped: true,
          sellSampleSize: 2,
        }),
      );

      expect(sellPriceCell.textContent).toBe(`${(250).toLocaleString()} (n=2)`);
    });

    it("should flag our listing as undercut when it has been", () => {
      const { sellPriceCell } = renderRow(
        readyRow({
          sellListingStatus: {
            state: "undercut",
            ourPricePerUnit: 300,
            rank: 6,
            cheaperListings: [{ pricePerUnit: 240, quantity: 10 }],
          },
        }),
      );

      expect(sellPriceCell.querySelector(".undercut-badge")).not.toBeNull();
    });

    it.each([
      { state: "not-listed" as const },
      { state: "competitive" as const, rank: 1 },
    ])(
      "should not flag our listing as undercut when it is $state",
      (sellListingStatus) => {
        const { sellPriceCell } = renderRow(readyRow({ sellListingStatus }));

        expect(sellPriceCell.querySelector(".undercut-badge")).toBeNull();
      },
    );
  });

  describe("showing profit", () => {
    it("should mark profitable figures as positive", () => {
      const {
        profitPerItemCell,
        profitPerStackCell,
        expectedProfitPerDayCell,
      } = renderRow(
        readyRow({
          profitPerItem: 132,
          profitPerStack: 13_068,
          expectedProfitPerDay: 500,
        }),
      );

      expect(profitPerItemCell.className).toBe("positive");
      expect(profitPerStackCell.className).toBe("positive");
      expect(expectedProfitPerDayCell.className).toBe("positive");
    });

    it("should treat breaking even as positive", () => {
      const { profitPerItemCell } = renderRow(readyRow({ profitPerItem: 0 }));

      expect(profitPerItemCell.className).toBe("positive");
    });

    it("should mark losses as negative", () => {
      const {
        profitPerItemCell,
        profitPerStackCell,
        expectedProfitPerDayCell,
      } = renderRow(
        readyRow({
          profitPerItem: -5,
          profitPerStack: -495,
          expectedProfitPerDay: -60,
        }),
      );

      expect(profitPerItemCell.className).toBe("negative");
      expect(profitPerStackCell.className).toBe("negative");
      expect(expectedProfitPerDayCell.className).toBe("negative");
    });

    it("should leave figures unmarked when there's no profit to show", () => {
      const {
        profitPerItemCell,
        profitPerStackCell,
        expectedProfitPerDayCell,
      } = renderRow(
        readyRow({
          profitPerItem: null,
          profitPerStack: null,
          expectedProfitPerDay: null,
        }),
      );

      expect(profitPerItemCell.className).toBe("");
      expect(profitPerStackCell.className).toBe("");
      expect(expectedProfitPerDayCell.className).toBe("");
      expect(profitPerItemCell.textContent).toBe("—");
    });

    it("should show each profit figure", () => {
      const {
        profitPerItemCell,
        profitPerStackCell,
        expectedProfitPerDayCell,
      } = renderRow(
        readyRow({
          profitPerItem: 132,
          profitPerStack: 13_068,
          expectedProfitPerDay: 500,
        }),
      );

      expect(profitPerItemCell.textContent).toBe((132).toLocaleString());
      expect(profitPerStackCell.textContent).toBe((13_068).toLocaleString());
      expect(figureIn(expectedProfitPerDayCell)).toBe((500).toLocaleString());
    });

    it("should explain the daily sale velocity behind expected daily profit", () => {
      const { expectedProfitPerDayCell } = renderRow(
        readyRow({ saleVelocityPerDay: 12.34 }),
      );

      expect(descriptionOf(figureElementIn(expectedProfitPerDayCell))).toBe(
        "Based on 12.3 sold in the last day",
      );
    });
  });

  describe("before any data has loaded", () => {
    it("should show a dash in every figure", () => {
      const {
        buyDataCenterCell,
        buyPriceCell,
        sellPriceCell,
        profitPerItemCell,
        profitPerStackCell,
        expectedProfitPerDayCell,
      } = renderRow(pendingRow());

      expect(buyDataCenterCell.textContent).toBe("—");
      expect(buyPriceCell.textContent).toBe("—");
      expect(sellPriceCell.textContent).toBe("—");
      expect(profitPerItemCell.textContent).toBe("—");
      expect(profitPerStackCell.textContent).toBe("—");
      expect(expectedProfitPerDayCell.textContent).toBe("—");
    });

    it("should not explain a sale velocity it doesn't have", () => {
      const { expectedProfitPerDayCell } = renderRow(pendingRow());

      expect(
        descriptionOf(figureElementIn(expectedProfitPerDayCell)),
      ).toBeNull();
    });

    it("should not show any pricing badges", () => {
      const { tr } = renderRow(pendingRow());

      expect(tr.querySelector(".gap-badge")).toBeNull();
      expect(tr.querySelector(".undercut-badge")).toBeNull();
      expect(tr.classList.contains("row-gap")).toBe(false);
    });
  });
});
