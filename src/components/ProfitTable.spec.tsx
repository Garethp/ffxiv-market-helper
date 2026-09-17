// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildMarketPageUrl } from "../api/universalis";
import type { DisplayRow } from "../types";
import { columnHeaderNames } from "../testing/columnHeaderNames";
import { descriptionOf } from "../testing/descriptionOf";
import { profitColumnHints } from "./pricingHints";
import { ProfitTable } from "./ProfitTable";

const displayRow = (itemId: number, name: string): DisplayRow => ({
  row: {
    item: { itemId, name, stackSize: 1, targetQuantity: 1 },
    analysis: { status: "pending" },
    lastSuccessAt: null,
    lastAttemptFailed: false,
    lastErrorMessage: null,
  },
  isRefreshing: false,
});

const staleReadyDisplayRow = (itemId: number, name: string): DisplayRow => ({
  row: {
    item: { itemId, name, stackSize: 1, targetQuantity: 1 },
    analysis: {
      status: "ready",
      buyDataCenter: "Chaos",
      buy: null,
      sellPricePerUnit: 250,
      sellSampleSize: 10,
      sellPriceSource: "history",
      sellPriceCapped: false,
      gapDetected: false,
      saleVelocityPerDay: 1,
      effectiveBuyPricePerUnit: null,
      effectiveSellPricePerUnit: 250,
      profitPerItem: null,
      profitPerStack: null,
      expectedProfitPerDay: null,
      sellListingStatus: { state: "not-listed" },
    },
    lastSuccessAt: Date.now() - 10 * 60_000,
    lastAttemptFailed: true,
    lastErrorMessage: null,
  },
  isRefreshing: false,
});

const table = (
  rows: DisplayRow[],
  {
    staleWarningThresholdMs = null,
    sellWorld = "WorldA",
    gapThresholdMultiplier = 1.1,
  }: {
    staleWarningThresholdMs?: number | null;
    sellWorld?: string;
    gapThresholdMultiplier?: number;
  } = {},
) => (
  <ProfitTable
    rows={rows}
    staleWarningThresholdMs={staleWarningThresholdMs}
    sellWorld={sellWorld}
    gapThresholdMultiplier={gapThresholdMultiplier}
  />
);

const renderTable = (
  rows: DisplayRow[],
  options?: {
    staleWarningThresholdMs?: number | null;
    sellWorld?: string;
    gapThresholdMultiplier?: number;
  },
) => render(table(rows, options));

const bodyRows = () => screen.getAllByRole("row").slice(1);

const rowFor = (name: string) => {
  const row = bodyRows().find((candidate) =>
    candidate.textContent?.includes(name),
  );
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

const hasCopiedIndicator = (name: string) =>
  within(rowFor(name)).queryByText("Copied!") !== null;

const copy = async (name: string) => {
  await act(async () => {
    fireEvent.click(
      within(rowFor(name)).getByRole("button", { name: "Copy item name" }),
    );
  });
};

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ProfitTable", () => {
  describe("layout", () => {
    it("should show a header for every column", () => {
      renderTable([]);

      expect(columnHeaderNames(document.body)).toEqual([
        "Item",
        "Buy DC",
        "Buy price / unit",
        "Sell price",
        "Profit / item",
        "Profit / stack",
        "Expected profit / day",
      ]);
    });

    it.each([
      ["buy price / unit", profitColumnHints.buyPrice],
      ["sell price", profitColumnHints.sellPrice(1.1)],
      ["profit / item", profitColumnHints.profitPerItem],
      ["expected profit / day", profitColumnHints.expectedProfitPerDay],
    ])("should explain how the %s is worked out", (column, explanation) => {
      renderTable([]);

      expect(
        descriptionOf(screen.getByRole("button", { name: `About ${column}` })),
      ).toBe(explanation);
    });

    it("should work the gap out from the gap threshold, so the two can't disagree", () => {
      renderTable([], { gapThresholdMultiplier: 1.25 });

      expect(
        descriptionOf(screen.getByRole("button", { name: "About sell price" })),
      ).toContain("at least 25% higher");
    });

    it("should show one row per item, in the order given", () => {
      renderTable([
        displayRow(1, "Wind Cluster"),
        displayRow(2, "Caramel Popcorn"),
        displayRow(3, "Heavens' Eye Materia XII"),
      ]);

      const rows = bodyRows();
      expect(rows).toHaveLength(3);
      expect(rows[0].textContent).toContain("Wind Cluster");
      expect(rows[1].textContent).toContain("Caramel Popcorn");
      expect(rows[2].textContent).toContain("Heavens' Eye Materia XII");
    });

    it("should keep an item priced as both NQ and HQ as two distinct rows", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const nq = displayRow(6141, "Cordial");
      const hq = displayRow(6141, "Cordial");
      hq.row.item.hq = true;

      renderTable([nq, hq]);

      expect(bodyRows()).toHaveLength(2);
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining("same key"),
        expect.anything(),
      );
      consoleError.mockRestore();
    });

    it("should show no item rows when there are no items", () => {
      renderTable([]);

      expect(bodyRows()).toHaveLength(0);
    });
  });

  describe("configuring every row", () => {
    it("should give every row the stale threshold and the sell world", () => {
      renderTable(
        [
          staleReadyDisplayRow(1, "Wind Cluster"),
          staleReadyDisplayRow(2, "Caramel Popcorn"),
        ],
        { staleWarningThresholdMs: 60_000, sellWorld: "Raiden" },
      );

      [
        { itemId: 1, name: "Wind Cluster" },
        { itemId: 2, name: "Caramel Popcorn" },
      ].forEach(({ itemId, name }) => {
        const row = rowFor(name);
        const sellPriceLink = row.querySelectorAll("td")[3].querySelector("a");
        expect(sellPriceLink?.getAttribute("href")).toBe(
          buildMarketPageUrl(itemId, "Raiden"),
        );
        expect(row.querySelector(".stale-badge")).not.toBeNull();
      });
    });
  });

  describe("copying an item name", () => {
    it("should copy that item's name to the clipboard", async () => {
      renderTable([
        displayRow(1, "Wind Cluster"),
        displayRow(2, "Caramel Popcorn"),
      ]);

      await copy("Caramel Popcorn");

      expect(writeText).toHaveBeenCalledWith("Caramel Popcorn");
    });

    it("should confirm the copy only on the row that was copied", async () => {
      renderTable([
        displayRow(1, "Wind Cluster"),
        displayRow(2, "Caramel Popcorn"),
      ]);

      await copy("Wind Cluster");

      expect(hasCopiedIndicator("Wind Cluster")).toBe(true);
      expect(hasCopiedIndicator("Caramel Popcorn")).toBe(false);
    });

    it("should move the confirmation to whichever row was copied most recently", async () => {
      renderTable([
        displayRow(1, "Wind Cluster"),
        displayRow(2, "Caramel Popcorn"),
      ]);

      await copy("Wind Cluster");
      await copy("Caramel Popcorn");

      expect(hasCopiedIndicator("Wind Cluster")).toBe(false);
      expect(hasCopiedIndicator("Caramel Popcorn")).toBe(true);
    });

    it("should keep the confirmation on the copied item when the rows are reordered", async () => {
      const windCluster = displayRow(1, "Wind Cluster");
      const caramelPopcorn = displayRow(2, "Caramel Popcorn");
      const { rerender } = renderTable([windCluster, caramelPopcorn]);

      await copy("Wind Cluster");
      rerender(table([caramelPopcorn, windCluster]));

      expect(bodyRows()[1].textContent).toContain("Wind Cluster");
      expect(hasCopiedIndicator("Wind Cluster")).toBe(true);
      expect(hasCopiedIndicator("Caramel Popcorn")).toBe(false);
    });

    it("should clear the confirmation after a short delay", async () => {
      vi.useFakeTimers();
      renderTable([displayRow(1, "Wind Cluster")]);

      await copy("Wind Cluster");
      act(() => {
        vi.advanceTimersByTime(1499);
      });
      expect(hasCopiedIndicator("Wind Cluster")).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(hasCopiedIndicator("Wind Cluster")).toBe(false);
    });

    it("should not let an earlier copy's delay clear a newer copy's confirmation", async () => {
      vi.useFakeTimers();
      renderTable([
        displayRow(1, "Wind Cluster"),
        displayRow(2, "Caramel Popcorn"),
      ]);

      await copy("Wind Cluster");
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      await copy("Caramel Popcorn");

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(hasCopiedIndicator("Caramel Popcorn")).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(hasCopiedIndicator("Caramel Popcorn")).toBe(false);
    });

    it("should show no confirmation when the clipboard refuses the write", async () => {
      writeText.mockRejectedValue(new Error("denied"));
      renderTable([displayRow(1, "Wind Cluster")]);

      await copy("Wind Cluster");

      expect(writeText).toHaveBeenCalledWith("Wind Cluster");
      expect(hasCopiedIndicator("Wind Cluster")).toBe(false);
    });
  });
});
