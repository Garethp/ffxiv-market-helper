// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildMarketPageUrl } from "../api/universalis";
import type { BuyingRegion } from "../services/tradingConfig";
import type { DisplayRow } from "../types";
import { BuyingRegionSection } from "./BuyingRegionSection";

afterEach(cleanup);

const displayRow = (
  itemId: number,
  name: string,
  rowOverrides: Partial<DisplayRow["row"]> = {},
): DisplayRow => ({
  row: {
    item: { itemId, name, stackSize: 1, targetQuantity: 1 },
    analysis: { status: "pending" },
    lastSuccessAt: null,
    lastAttemptFailed: false,
    lastErrorMessage: null,
    ...rowOverrides,
  },
  isRefreshing: false,
});

const renderSection = (
  buyingRegion: BuyingRegion,
  {
    rows = [],
    staleWarningThresholdMs = null,
    sellWorld = "Raiden",
    gapThresholdMultiplier = 1.1,
  }: {
    rows?: DisplayRow[];
    staleWarningThresholdMs?: number | null;
    gapThresholdMultiplier?: number;
    sellWorld?: string;
  } = {},
) =>
  render(
    <BuyingRegionSection
      buyingRegion={buyingRegion}
      rows={rows}
      staleWarningThresholdMs={staleWarningThresholdMs}
      sellWorld={sellWorld}
      gapThresholdMultiplier={gapThresholdMultiplier}
    />,
  );

describe("BuyingRegionSection", () => {
  describe("introducing the region", () => {
    it("should name the region and every character buying through it", () => {
      renderSection({
        region: "Japan",
        characters: [
          { id: "bob", name: "Bob" },
          { id: "carol", name: "Carol" },
        ],
      });

      expect(screen.getByRole("heading").textContent).toBe(
        "Buying via Bob, Carol (Japan)",
      );
    });

    it("should show the note of each character that has one", () => {
      const { container } = renderSection({
        region: "Japan",
        characters: [
          { id: "bob", name: "Bob", note: "Needs a meetup to hand goods over" },
          { id: "carol", name: "Carol" },
          { id: "dave", name: "Dave", note: "Retainers only" },
        ],
      });

      expect(
        Array.from(container.querySelectorAll(".character-note")).map(
          (note) => note.textContent,
        ),
      ).toEqual([
        "Bob: Needs a meetup to hand goods over",
        "Dave: Retainers only",
      ]);
    });
  });

  describe("showing profit", () => {
    it("should show a row for each item, in the order given", () => {
      renderSection(
        { region: "Europe", characters: [{ id: "alice", name: "Alice" }] },
        {
          rows: [
            displayRow(1, "Wind Cluster"),
            displayRow(2, "Caramel Popcorn"),
          ],
        },
      );

      const [, ...itemRows] = screen.getAllByRole("row");
      expect(itemRows.map((row) => row.textContent)).toEqual([
        expect.stringContaining("Wind Cluster"),
        expect.stringContaining("Caramel Popcorn"),
      ]);
    });

    it("should give every row the stale threshold and the sell world", () => {
      const { container } = renderSection(
        { region: "Europe", characters: [{ id: "alice", name: "Alice" }] },
        {
          rows: [displayRow(1, "Wind Cluster", { lastAttemptFailed: true })],
          staleWarningThresholdMs: 0,
          sellWorld: "Raiden",
        },
      );

      expect(container.querySelector(".stale-badge")).not.toBeNull();
      expect(
        screen.getAllByRole("link").map((link) => link.getAttribute("href")),
      ).toContain(buildMarketPageUrl(1, "Raiden"));
    });
  });
});
