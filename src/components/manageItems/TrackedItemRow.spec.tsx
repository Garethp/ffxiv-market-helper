// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackedItem } from "../../types";
import { TrackedItemRow } from "./TrackedItemRow";
import { createQueryClientWrapper } from "../../testing/createQueryClientWrapper";

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
        <TrackedItemRow
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

describe("TrackedItemRow", () => {
  afterEach(() => {
    cleanup();
  });

  describe("showing the item", () => {
    it("should show the item's name, target quantity and sell price ceiling", () => {
      renderRow(
        buildTrackedItem({ targetQuantity: 60, sellPriceCeiling: 5000 }),
      );

      expect(getRowText()).toContain("Cordial");
      expect(getRowText()).toContain("Target quantity 60");
      expect(getRowText()).toContain("Sell price ceiling 5k");
    });

    it("should say when the item has no sell price ceiling", () => {
      renderRow(buildTrackedItem());

      expect(getRowText()).toContain("No sell price ceiling");
    });

    it("should mark an HQ item as HQ", () => {
      renderRow(buildTrackedItem({ hq: true }));

      expect(getRowText()).toContain("HQ");
    });
  });

  describe("changing the item's settings", () => {
    it("should lead to the page for it, rather than editing in place", () => {
      renderRow(buildTrackedItem(), { editHref: "/manage-items/edit/cordial" });

      const link = screen.getByRole("link", { name: "Edit Cordial (NQ)" });

      expect(link.getAttribute("href")).toBe("/manage-items/edit/cordial");
      expect(screen.queryByRole("form")).toBeNull();
    });
  });

  describe("no longer tracking the item", () => {
    it("should report that the item is no longer to be tracked", () => {
      const { onUntrack } = renderRow(buildTrackedItem());

      fireEvent.click(
        screen.getByRole("button", { name: "Stop tracking Cordial (NQ)" }),
      );

      expect(onUntrack).toHaveBeenCalledOnce();
    });

    it("should show why the last change wasn't made, alongside the item", () => {
      renderRow(buildTrackedItem(), {
        errorMessage: "Something went wrong. Try again shortly.",
      });

      expect(screen.getByRole("alert").textContent).toBe(
        "Something went wrong. Try again shortly.",
      );
    });

    it("should show nothing when there's no reason to show", () => {
      renderRow(buildTrackedItem());

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
