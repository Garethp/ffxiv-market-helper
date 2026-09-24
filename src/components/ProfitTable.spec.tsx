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
import { getDescription } from "../testing/getDescription";
import { ProfitTable } from "./ProfitTable";
import { createQueryClientWrapper } from "../testing/createQueryClientWrapper";

const buildDisplayRow = (itemId: number, name: string): DisplayRow => ({
  row: {
    item: { itemId, name, stackSize: 1, targetQuantity: 1 },
    analysis: { status: "pending" },
  },
  isRefreshing: false,
});

const buildReadyDisplayRow = (itemId: number, name: string): DisplayRow => ({
  row: {
    item: { itemId, name, stackSize: 1, targetQuantity: 1 },
    analysis: {
      status: "ready",
      buyDataCenter: "Chaos",
      buy: undefined,
      sellPricePerUnit: 250,
      sellPriceSource: "history",
      sellPriceCapped: false,
      gapDetected: false,
      saleVelocityPerDay: 1,
      effectiveBuyPricePerUnit: undefined,
      effectiveSellPricePerUnit: 250,
      profitPerItem: undefined,
      profitPerStack: undefined,
      expectedProfitPerDay: undefined,
      sellListingStatus: { state: "not-listed" },
    },
  },
  isRefreshing: false,
});

const buildTable = (
  rows: DisplayRow[],
  {
    sellWorld = "WorldA",
    gapThresholdMultiplier = 1.1,
  }: {
    sellWorld?: string;
    gapThresholdMultiplier?: number;
  } = {},
) => (
  <ProfitTable
    rows={rows}
    sellWorld={sellWorld}
    gapThresholdMultiplier={gapThresholdMultiplier}
  />
);

const renderTable = (
  rows: DisplayRow[],
  options?: {
    sellWorld?: string;
    gapThresholdMultiplier?: number;
  },
) => render(buildTable(rows, options), { wrapper: createQueryClientWrapper() });

const getBodyRows = () => screen.getAllByRole("row").slice(1);

const getRowFor = (name: string) => {
  const row = getBodyRows().find((candidate) =>
    candidate.textContent?.includes(name),
  );
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

const hasCopiedIndicator = (name: string) =>
  within(getRowFor(name)).queryByText("Copied!") !== null;

const copy = async (name: string) => {
  await act(async () => {
    fireEvent.click(
      within(getRowFor(name)).getByRole("button", { name: "Copy item name" }),
    );
  });
};

let writeText: ReturnType<typeof vi.fn>;

describe("ProfitTable", () => {
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

  describe("layout", () => {
    it("should work the gap out from the gap threshold, so the two can't disagree", () => {
      renderTable([], { gapThresholdMultiplier: 1.25 });

      expect(
        getDescription(
          screen.getByRole("button", { name: "About sell price" }),
        ),
      ).toContain("at least 25% higher");
    });

    it("should show one row per item, in the order given", () => {
      renderTable([
        buildDisplayRow(1, "Wind Cluster"),
        buildDisplayRow(2, "Caramel Popcorn"),
        buildDisplayRow(3, "Heavens' Eye Materia XII"),
      ]);

      const rows = getBodyRows();
      expect(rows).toHaveLength(3);
      expect(rows[0].textContent).toContain("Wind Cluster");
      expect(rows[1].textContent).toContain("Caramel Popcorn");
      expect(rows[2].textContent).toContain("Heavens' Eye Materia XII");
    });

    it("should keep an item priced as both NQ and HQ as two distinct rows", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const nq = buildDisplayRow(6141, "Cordial");
      const hq = buildDisplayRow(6141, "Cordial");
      hq.row.item.hq = true;

      renderTable([nq, hq]);

      expect(getBodyRows()).toHaveLength(2);
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining("same key"),
        expect.anything(),
      );
      consoleError.mockRestore();
    });
  });

  describe("configuring every row", () => {
    it("should give every row the sell world", () => {
      renderTable(
        [
          buildReadyDisplayRow(1, "Wind Cluster"),
          buildReadyDisplayRow(2, "Caramel Popcorn"),
        ],
        { sellWorld: "Raiden" },
      );

      [
        { itemId: 1, name: "Wind Cluster" },
        { itemId: 2, name: "Caramel Popcorn" },
      ].forEach(({ itemId, name }) => {
        const row = getRowFor(name);
        const sellPriceLink = row.querySelectorAll("td")[3].querySelector("a");
        expect(sellPriceLink?.getAttribute("href")).toBe(
          buildMarketPageUrl(itemId, "Raiden"),
        );
      });
    });
  });

  describe("copying an item name", () => {
    it("should copy that item's name to the clipboard", async () => {
      renderTable([
        buildDisplayRow(1, "Wind Cluster"),
        buildDisplayRow(2, "Caramel Popcorn"),
      ]);

      await copy("Caramel Popcorn");

      expect(writeText).toHaveBeenCalledWith("Caramel Popcorn");
    });

    it("should keep the confirmation on the copied item when the rows are reordered", async () => {
      const windCluster = buildDisplayRow(1, "Wind Cluster");
      const caramelPopcorn = buildDisplayRow(2, "Caramel Popcorn");
      const { rerender } = renderTable([windCluster, caramelPopcorn]);

      await copy("Wind Cluster");
      rerender(buildTable([caramelPopcorn, windCluster]));

      expect(getBodyRows()[1].textContent).toContain("Wind Cluster");
      expect(hasCopiedIndicator("Wind Cluster")).toBe(true);
      expect(hasCopiedIndicator("Caramel Popcorn")).toBe(false);
    });

    it("should clear the confirmation after a short delay", async () => {
      vi.useFakeTimers();
      renderTable([buildDisplayRow(1, "Wind Cluster")]);

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
        buildDisplayRow(1, "Wind Cluster"),
        buildDisplayRow(2, "Caramel Popcorn"),
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

    it("should not let an earlier copy's delay clear the confirmation of copying the same item again", async () => {
      vi.useFakeTimers();
      renderTable([buildDisplayRow(1, "Wind Cluster")]);

      await copy("Wind Cluster");
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      await copy("Wind Cluster");

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(hasCopiedIndicator("Wind Cluster")).toBe(true);
    });

    it("should confirm the copy only on the row copied from, even when another row is the same item", async () => {
      const nq = buildDisplayRow(1, "Wind Cluster");
      const hq: DisplayRow = {
        ...nq,
        row: { ...nq.row, item: { ...nq.row.item, hq: true } },
      };
      renderTable([nq, hq, buildDisplayRow(2, "Caramel Popcorn")]);

      await copy("Wind Cluster");

      const windClusterRows = getBodyRows().filter((row) =>
        row.textContent?.includes("Wind Cluster"),
      );
      expect(
        windClusterRows.map(
          (row) => within(row).queryByText("Copied!") !== null,
        ),
      ).toEqual([true, false]);
      expect(hasCopiedIndicator("Caramel Popcorn")).toBe(false);
    });

    it("should show no confirmation when the clipboard refuses the write", async () => {
      writeText.mockRejectedValue(new Error("denied"));
      renderTable([buildDisplayRow(1, "Wind Cluster")]);

      await copy("Wind Cluster");

      expect(writeText).toHaveBeenCalledWith("Wind Cluster");
      expect(hasCopiedIndicator("Wind Cluster")).toBe(false);
    });
  });
});
