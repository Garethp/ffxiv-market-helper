// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { buildMarketPageUrl } from "../api/universalis";
import type { ScannedItem } from "../hooks/useHighVolumeItemScan";
import { ScannedItemsTable } from "./ScannedItemsTable";

afterEach(cleanup);

const scannedItem = (overrides: Partial<ScannedItem> = {}): ScannedItem => ({
  itemId: 1,
  nqSaleVelocity: 10,
  hqSaleVelocity: 5,
  totalSaleVelocity: 15,
  ...overrides,
});

const renderTable = (
  items: ScannedItem[],
  itemNames: Record<number, string> = {},
  world = "Raiden",
) =>
  render(
    <MemoryRouter>
      <ScannedItemsTable items={items} itemNames={itemNames} world={world} />
    </MemoryRouter>,
  );

const bodyRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("tbody tr"));

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
});
