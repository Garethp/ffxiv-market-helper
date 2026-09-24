// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemSummary, TrackedItem } from "../../types";

vi.mock("../../services/itemService", () => ({
  itemService: { getItemSummaries: vi.fn() },
}));

import { itemService } from "../../services/itemService";
import { createQueryClientWrapper } from "../../testing/createQueryClientWrapper";
import { TrackedItemExpandableRow } from "./TrackedItemExpandableRow";

const mockedGetItemSummaries = vi.mocked(itemService.getItemSummaries);

const cordialSummary: ItemSummary = {
  type: "Medicine",
  description: "Restores GP.",
};

const buildTrackedItem = (
  overrides: Partial<TrackedItem> = {},
): TrackedItem => ({
  id: "cordial",
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
  targetQuantity: 999,
  ...overrides,
});

const renderRow = (
  item: TrackedItem,
  props: Partial<{
    editHref: string;
    errorMessage: string;
    onUntrack: () => void;
  }> = {},
) => {
  const handlers = { onUntrack: vi.fn(), ...props };
  render(
    <MemoryRouter>
      <ul>
        <TrackedItemExpandableRow
          item={item}
          editHref="/manage-items/edit/cordial"
          {...handlers}
        />
      </ul>
    </MemoryRouter>,
    { wrapper: createQueryClientWrapper() },
  );
  return handlers;
};

const getRowText = () => screen.getByRole("listitem").textContent;

/** The value shown against one of the row's labelled figures. */
const getFigure = (label: string) =>
  screen.getByText(label).nextElementSibling?.textContent;

const expand = (description = "Cordial (NQ)") =>
  fireEvent.click(
    screen.getByRole("button", { name: `Show what ${description} is` }),
  );

describe("TrackedItemExpandableRow", () => {
  beforeEach(() => {
    mockedGetItemSummaries.mockResolvedValue(new Map([[6141, cordialSummary]]));
  });

  afterEach(() => {
    cleanup();
    mockedGetItemSummaries.mockReset();
  });

  describe("collapsed", () => {
    it("should show what the item is tracked as, and none of the ways to change it", () => {
      renderRow(buildTrackedItem({ hq: true, sellPriceCeiling: 5000 }));

      expect(getRowText()).toContain("Cordial");
      expect(getRowText()).toContain("HQ");
      expect(getFigure("Target quantity")).toBe("999");
      expect(getFigure("Sell price ceiling")).toBe("5k");
      expect(screen.queryByRole("link")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Stop tracking Cordial (HQ)" }),
      ).toBeNull();
    });

    it("should show an item with no sell price ceiling as having none", () => {
      renderRow(buildTrackedItem());

      expect(getFigure("Sell price ceiling")).toBe("none");
    });
  });

  it("should look the item up only once the row is opened, so a long list doesn't fetch every item", async () => {
    renderRow(buildTrackedItem());
    expect(mockedGetItemSummaries).not.toHaveBeenCalled();

    expand();

    await screen.findByText("Medicine");
    expect(mockedGetItemSummaries).toHaveBeenCalledWith([6141]);
  });

  describe("expanded", () => {
    it("should show what the item is, in place of the tooltip a phone can't hover, keeping what it's tracked as", async () => {
      renderRow(buildTrackedItem({ sellPriceCeiling: 5000 }));

      expand();

      expect(await screen.findByText("Medicine")).toBeTruthy();
      expect(screen.getByText("Restores GP.")).toBeTruthy();
      expect(screen.getByRole("presentation").getAttribute("src")).toContain(
        "6141",
      );
      expect(getFigure("Target quantity")).toBe("999");
      expect(getFigure("Sell price ceiling")).toBe("5k");
    });

    it("should offer the ways to change the item", () => {
      const { onUntrack } = renderRow(buildTrackedItem(), {
        editHref: "/manage-items/edit/cordial",
      });

      expand();

      expect(
        screen
          .getByRole("link", { name: "Edit Cordial (NQ)" })
          .getAttribute("href"),
      ).toBe("/manage-items/edit/cordial");
      fireEvent.click(
        screen.getByRole("button", { name: "Stop tracking Cordial (NQ)" }),
      );
      expect(onUntrack).toHaveBeenCalledOnce();
    });
  });

  it("should show why the last change wasn't made, whether opened or not", () => {
    renderRow(buildTrackedItem(), {
      errorMessage: "Something went wrong. Try again shortly.",
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "Something went wrong. Try again shortly.",
    );

    expand();

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
