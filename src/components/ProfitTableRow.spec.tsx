// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDescription } from "../testing/getDescription";
import type { ProfitPricing, ProfitRow, PricedItem } from "../types";
import { ProfitTableRow } from "./ProfitTableRow";
import { createQueryClientWrapper } from "../testing/createQueryClientWrapper";

const item: PricedItem = {
  itemId: 42,
  name: "Wind Cluster",
  stackSize: 99,
  targetQuantity: 297,
};

const buildReadyRow = (
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
  ...rowOverrides,
});

const buildPendingRow = (): ProfitRow => ({
  item,
  analysis: { status: "pending" },
});

/** The element showing a cell's figure, which carries the tooltip explaining it. */
const getFigureElementIn = (cell: HTMLTableCellElement) =>
  cell.querySelector("[aria-describedby]");

const getFigureIn = (cell: HTMLTableCellElement) =>
  getFigureElementIn(cell)?.textContent ?? cell.textContent;

const renderRow = (
  row: ProfitRow,
  {
    isRefreshing = false,
    sellWorld = "Raiden",
    isCopied = false,
    onCopyName = () => {},
  }: {
    isRefreshing?: boolean;
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
          sellWorld={sellWorld}
          isCopied={isCopied}
          onCopyName={onCopyName}
        />
      </tbody>
    </table>,
    { wrapper: createQueryClientWrapper() },
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

describe("ProfitTableRow", () => {
  afterEach(() => {
    cleanup();
  });

  describe("identifying the item", () => {
    it("should ask to copy the item's name when the copy button is clicked", () => {
      const onCopyName = vi.fn();
      const { itemCell } = renderRow(buildReadyRow(), { onCopyName });

      fireEvent.click(itemCell.querySelector("button")!);

      expect(onCopyName).toHaveBeenCalledTimes(1);
    });

    it("should label an item priced as high quality", () => {
      const { itemCell } = renderRow(
        buildReadyRow({}, { item: { ...item, hq: true } }),
      );

      expect(itemCell.querySelector(".quality-badge")?.textContent).toBe("HQ");
    });

    it("should not label an item priced as normal quality", () => {
      const { itemCell } = renderRow(buildReadyRow());

      expect(itemCell.querySelector(".quality-badge")).toBeNull();
    });
  });

  describe("highlighting the row", () => {
    it("should flag a supply gap on both the item and the row", () => {
      const { tr, itemCell } = renderRow(buildReadyRow({ gapDetected: true }));

      expect(itemCell.querySelector(".gap-badge")?.textContent).toBe("gap");
      expect(tr.classList.contains("row-gap")).toBe(true);
    });

    it("should not flag a supply gap when none was detected", () => {
      const { tr, itemCell } = renderRow(buildReadyRow({ gapDetected: false }));

      expect(itemCell.querySelector(".gap-badge")).toBeNull();
      expect(tr.classList.contains("row-gap")).toBe(false);
    });

    it("should mark the row while it's refreshing", () => {
      const { tr } = renderRow(buildReadyRow(), { isRefreshing: true });

      expect(tr.classList.contains("row-refreshing")).toBe(true);
    });

    it("should flag a supply gap and mark the row as refreshing at the same time", () => {
      const { tr } = renderRow(buildReadyRow({ gapDetected: true }), {
        isRefreshing: true,
      });

      expect(tr.classList.contains("row-gap")).toBe(true);
      expect(tr.classList.contains("row-refreshing")).toBe(true);
    });
  });

  describe("showing where and for how much to buy", () => {
    it("should link the buy data center to its market page", () => {
      const { buyDataCenterCell } = renderRow(
        buildReadyRow({ buyDataCenter: "Chaos" }),
      );

      const link = buyDataCenterCell.querySelector("a");
      expect(link?.textContent).toBe("Chaos");
      expect(link?.getAttribute("href")).toBe(
        "https://universalis.app/market/42?server=Chaos",
      );
    });

    it("should show a dash for the data center when there's nothing to buy", () => {
      const { buyDataCenterCell } = renderRow(
        buildReadyRow({ buy: undefined }),
      );

      expect(buyDataCenterCell.querySelector("a")).toBeNull();
      expect(buyDataCenterCell.textContent).toBe("—");
    });

    it("should show the buy price per unit, rounded", () => {
      const { buyPriceCell } = renderRow(
        buildReadyRow({
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
      const { sellPriceCell } = renderRow(
        buildReadyRow({ sellPricePerUnit: 250 }),
        {
          sellWorld: "Raiden",
        },
      );

      const link = sellPriceCell.querySelector("a");
      expect(link?.textContent).toBe((250).toLocaleString());
      expect(link?.getAttribute("href")).toBe(
        "https://universalis.app/market/42?server=Raiden",
      );
    });

    it("should flag our listing as undercut when it has been", () => {
      const { sellPriceCell } = renderRow(
        buildReadyRow({
          sellListingStatus: {
            state: "undercut",
            ourPricePerUnit: 300,
            rank: 6,
            cheapestListings: [
              {
                pricePerUnit: 240,
                quantity: 10,
                retainerName: "Someone",
                ours: false,
              },
            ],
          },
        }),
      );

      expect(sellPriceCell.querySelector(".undercut-badge")).not.toBeNull();
    });

    it.each([{ state: "not-listed" as const }])(
      "should not flag our listing as undercut when it is $state",
      (sellListingStatus) => {
        const { sellPriceCell } = renderRow(
          buildReadyRow({ sellListingStatus }),
        );

        expect(sellPriceCell.querySelector(".undercut-badge")).toBeNull();
      },
    );
  });

  describe("showing profit", () => {
    it("should mark each profit figure as a gain or a loss", () => {
      const {
        profitPerItemCell,
        profitPerStackCell,
        expectedProfitPerDayCell,
      } = renderRow(
        buildReadyRow({
          profitPerItem: 132,
          profitPerStack: -495,
          expectedProfitPerDay: -60,
        }),
      );

      expect(profitPerItemCell.querySelector(".positive")).not.toBeNull();
      expect(profitPerStackCell.querySelector(".negative")).not.toBeNull();
      expect(
        expectedProfitPerDayCell.querySelector(".negative"),
      ).not.toBeNull();
    });

    it("should show each profit figure", () => {
      const {
        profitPerItemCell,
        profitPerStackCell,
        expectedProfitPerDayCell,
      } = renderRow(
        buildReadyRow({
          profitPerItem: 132,
          profitPerStack: 13_068,
          expectedProfitPerDay: 500,
        }),
      );

      expect(profitPerItemCell.textContent).toBe((132).toLocaleString());
      expect(profitPerStackCell.textContent).toBe((13_068).toLocaleString());
      expect(getFigureIn(expectedProfitPerDayCell)).toBe(
        (500).toLocaleString(),
      );
    });

    it("should explain the daily sale velocity behind expected daily profit", () => {
      const { expectedProfitPerDayCell } = renderRow(
        buildReadyRow({ saleVelocityPerDay: 12.34 }),
      );

      expect(getDescription(getFigureElementIn(expectedProfitPerDayCell))).toBe(
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
      } = renderRow(buildPendingRow());

      expect(buyDataCenterCell.textContent).toBe("—");
      expect(buyPriceCell.textContent).toBe("—");
      expect(sellPriceCell.textContent).toBe("—");
      expect(profitPerItemCell.textContent).toBe("—");
      expect(profitPerStackCell.textContent).toBe("—");
      expect(expectedProfitPerDayCell.textContent).toBe("—");
    });
  });
});
