// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackedItemSettings } from "../services/trackedItemService";
import type { TrackedItem } from "../types";
import { TrackedItemRow } from "./TrackedItemRow";
import { withQueryClient } from "../testing/withQueryClient";

const aTrackedItem = (overrides: Partial<TrackedItem> = {}): TrackedItem => ({
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
    isEditing: boolean;
    errorMessage: string | null;
    onEdit: () => void;
    onCancelEdit: () => void;
    onUpdate: (settings: TrackedItemSettings) => void;
    onUntrack: () => void;
  }> = {},
) => {
  const handlers = {
    onEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onUpdate: vi.fn(),
    onUntrack: vi.fn(),
    ...props,
  };
  render(
    <ul>
      <TrackedItemRow item={item} isEditing={false} {...handlers} />
    </ul>,
    { wrapper: withQueryClient() },
  );
  return handlers;
};

const rowText = () => screen.getByRole("listitem").textContent;

const editForm = (name: string) => screen.getByRole("form", { name });

afterEach(cleanup);

describe("TrackedItemRow", () => {
  describe("showing the item", () => {
    it("should show the item's name, target quantity and sell price ceiling", () => {
      renderRow(aTrackedItem({ targetQuantity: 60, sellPriceCeiling: 5000 }));

      expect(rowText()).toContain("Cordial");
      expect(rowText()).toContain("Target quantity 60");
      expect(rowText()).toContain("Sell price ceiling 5k");
    });

    it("should say when the item has no sell price ceiling", () => {
      renderRow(aTrackedItem());

      expect(rowText()).toContain("No sell price ceiling");
    });

    it("should mark an HQ item as HQ", () => {
      renderRow(aTrackedItem({ hq: true }));

      expect(rowText()).toContain("HQ");
    });
  });

  describe("editing the item", () => {
    it("should ask for editing to start rather than opening a form itself", () => {
      const { onEdit } = renderRow(aTrackedItem());

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );

      expect(onEdit).toHaveBeenCalledOnce();
      expect(screen.queryByRole("form")).toBeNull();
    });

    it("should show a form filled in with the item's current settings while it's being edited", () => {
      renderRow(
        aTrackedItem({ hq: true, targetQuantity: 60, sellPriceCeiling: 5000 }),
        { isEditing: true },
      );

      const form = editForm("Edit Cordial (HQ)");
      expect(
        (within(form).getByLabelText("HQ") as HTMLInputElement).checked,
      ).toBe(true);
      expect(
        (within(form).getByLabelText("Target quantity") as HTMLInputElement)
          .value,
      ).toBe("60");
      expect(
        (within(form).getByLabelText("Sell price ceiling") as HTMLInputElement)
          .value,
      ).toBe("5k");
    });

    it("should pass on the entered settings", () => {
      const { onUpdate } = renderRow(aTrackedItem(), { isEditing: true });

      const form = editForm("Edit Cordial (NQ)");
      fireEvent.click(within(form).getByLabelText("HQ"));
      fireEvent.change(within(form).getByLabelText("Target quantity"), {
        target: { value: "60" },
      });
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));

      expect(onUpdate).toHaveBeenCalledWith({
        hq: true,
        targetQuantity: 60,
        sellPriceCeiling: undefined,
      });
    });

    it("should show why the last change wasn't made, while the form stays open", () => {
      renderRow(aTrackedItem(), {
        isEditing: true,
        errorMessage: "Cordial is already tracked as HQ.",
      });

      expect(screen.getByRole("alert").textContent).toBe(
        "Cordial is already tracked as HQ.",
      );
      expect(editForm("Edit Cordial (NQ)")).toBeTruthy();
    });

    it("should report a cancellation without passing on anything", () => {
      const { onCancelEdit, onUpdate } = renderRow(aTrackedItem(), {
        isEditing: true,
      });

      fireEvent.change(
        within(editForm("Edit Cordial (NQ)")).getByLabelText("Target quantity"),
        { target: { value: "60" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancelEdit).toHaveBeenCalledOnce();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("no longer tracking the item", () => {
    it("should report that the item is no longer to be tracked", () => {
      const { onUntrack } = renderRow(aTrackedItem());

      fireEvent.click(
        screen.getByRole("button", { name: "Stop tracking Cordial (NQ)" }),
      );

      expect(onUntrack).toHaveBeenCalledOnce();
    });

    it("should show why the last change wasn't made, alongside the item", () => {
      renderRow(aTrackedItem(), {
        errorMessage: "Something went wrong. Try again shortly.",
      });

      expect(screen.getByRole("alert").textContent).toBe(
        "Something went wrong. Try again shortly.",
      );
    });
  });
});
