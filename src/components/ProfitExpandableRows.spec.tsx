// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildMarketPageUrl } from "../api/universalis";
import { createQueryClientWrapper } from "../testing/createQueryClientWrapper";
import type { DisplayRow } from "../types";
import { ProfitExpandableRows } from "./ProfitExpandableRows";

const undercutRow: DisplayRow = {
  row: {
    item: {
      itemId: 42,
      name: "Wind Cluster",
      stackSize: 99,
      targetQuantity: 1,
    },
    analysis: {
      status: "ready",
      buyDataCenter: "Chaos",
      buy: {
        pricePerUnit: 100,
        quantityFilled: 99,
        fullyFilled: true,
        cheapestWorld: "Omega",
      },
      sellPricePerUnit: 250,
      sellPriceSource: "history",
      sellPriceCapped: false,
      gapDetected: false,
      saleVelocityPerDay: 12,
      effectiveBuyPricePerUnit: 105,
      effectiveSellPricePerUnit: 237.5,
      profitPerItem: 132,
      profitPerStack: 13_068,
      expectedProfitPerDay: 500,
      sellListingStatus: {
        state: "undercut",
        ourPricePerUnit: 260,
        rank: 4,
        cheapestListings: [],
      },
    },
  },
  isRefreshing: false,
};

const renderRows = () =>
  render(<ProfitExpandableRows rows={[undercutRow]} sellWorld="Raiden" />, {
    wrapper: createQueryClientWrapper(),
  });

/** What an element shows, leaving out the tooltips explaining it, which only show on hover. */
const getShownText = (element: Element) => {
  const copy = element.cloneNode(true) as Element;
  copy
    .querySelectorAll('[role="tooltip"]')
    .forEach((tooltip) => tooltip.remove());
  return copy.textContent;
};

/** Each figure showing, by what it is, in the order shown. */
const getFiguresShown = () =>
  Object.fromEntries(
    Array.from(document.querySelectorAll("dt")).map((dt) => [
      dt.textContent,
      dt.nextElementSibling && getShownText(dt.nextElementSibling),
    ]),
  );

describe("ProfitExpandableRows", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show what an item's worth a stack and a day, and that it's been undercut, until it's expanded", () => {
    renderRows();

    expect(getFiguresShown()).toEqual({
      "Profit / stack": (13_068).toLocaleString(),
      "Profit / day": (500).toLocaleString(),
    });
    expect(screen.queryByText("undercut")).not.toBeNull();
  });

  it("should show every figure once expanded, linking to where to buy and sell", () => {
    renderRows();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show every figure for Wind Cluster",
      }),
    );

    expect(Object.entries(getFiguresShown())).toEqual([
      ["Buy DC", "Chaos"],
      ["Buy price / unit", (100).toLocaleString()],
      ["Sell price", (250).toLocaleString()],
      ["Profit / item", (132).toLocaleString()],
      ["Profit / stack", (13_068).toLocaleString()],
      ["Expected profit / day", (500).toLocaleString()],
    ]);
    expect(
      screen.getByRole("link", { name: "Chaos" }).getAttribute("href"),
    ).toBe(buildMarketPageUrl(42, "Chaos"));
    expect(
      screen
        .getByRole("link", { name: (250).toLocaleString() })
        .getAttribute("href"),
    ).toBe(buildMarketPageUrl(42, "Raiden"));
  });
});
