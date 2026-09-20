// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  TrackedItemChangeResult,
  TrackedItemSettings,
} from "../services/trackedItemService";
import type { TrackedItem } from "../types";
import { TrackedItemRow } from "./TrackedItemRow";
import { withQueryClient } from "../testing/withQueryClient";

const saved = async (): Promise<TrackedItemChangeResult> => ({ ok: true });

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
  handlers: Partial<{
    onUpdate: (
      settings: TrackedItemSettings,
    ) => Promise<TrackedItemChangeResult>;
    onUntrack: () => void;
  }> = {},
) =>
  render(
    <ul>
      <TrackedItemRow
        item={item}
        onUpdate={saved}
        onUntrack={() => {}}
        {...handlers}
      />
    </ul>,
    { wrapper: withQueryClient() },
  );

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

      expect(document.querySelector(".quality-badge")?.textContent).toBe("HQ");
    });
  });

  describe("editing the item", () => {
    it("should open a form filled in with the item's current settings", () => {
      renderRow(
        aTrackedItem({ hq: true, targetQuantity: 60, sellPriceCeiling: 5000 }),
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (HQ)" }),
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

    it("should save the entered settings and close the form once they're saved", async () => {
      const onUpdate = vi.fn(saved);
      renderRow(aTrackedItem(), { onUpdate });

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );
      const form = editForm("Edit Cordial (NQ)");
      fireEvent.click(within(form).getByLabelText("HQ"));
      fireEvent.change(within(form).getByLabelText("Target quantity"), {
        target: { value: "60" },
      });
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));

      await screen.findByRole("button", { name: "Edit Cordial (NQ)" });
      expect(onUpdate).toHaveBeenCalledWith({
        hq: true,
        targetQuantity: 60,
        sellPriceCeiling: undefined,
      });
      expect(screen.queryByRole("form")).toBeNull();
    });

    it("should keep the form open, explaining why, when the settings can't be saved", async () => {
      renderRow(aTrackedItem(), {
        onUpdate: async () => ({
          ok: false,
          error: { reason: "already-tracked", name: "Cordial", hq: true },
        }),
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );
      const form = editForm("Edit Cordial (NQ)");
      fireEvent.click(within(form).getByLabelText("HQ"));
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Cordial is already tracked as HQ.",
      );
      expect(editForm("Edit Cordial (NQ)")).toBeTruthy();
    });

    it("should close the form without saving anything when editing is cancelled", () => {
      const onUpdate = vi.fn(saved);
      renderRow(aTrackedItem(), { onUpdate });

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );
      fireEvent.change(
        within(editForm("Edit Cordial (NQ)")).getByLabelText("Target quantity"),
        { target: { value: "60" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("form")).toBeNull();
      expect(rowText()).toContain("Target quantity 999");
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("no longer tracking the item", () => {
    it("should report that the item is no longer to be tracked", () => {
      const onUntrack = vi.fn();
      renderRow(aTrackedItem(), { onUntrack });

      fireEvent.click(
        screen.getByRole("button", { name: "Stop tracking Cordial (NQ)" }),
      );

      expect(onUntrack).toHaveBeenCalledOnce();
    });
  });
});
