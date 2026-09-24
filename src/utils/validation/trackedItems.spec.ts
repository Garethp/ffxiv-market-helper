import { describe, expect, it } from "vitest";
import type { PricedItem, TrackedItem } from "../../types";
import { validateItem } from "./trackedItems";

const cordial: PricedItem = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
  targetQuantity: 999,
};

const buildTrackedItem = (
  item: PricedItem,
  id = "tracked-id",
): TrackedItem => ({
  id,
  ...item,
});

describe("validateItem", () => {
  describe("an item nothing is wrong with", () => {
    it("should give no reason at all", () => {
      expect(validateItem(cordial, [])).toBeUndefined();
    });

    it("should give no reason when the same item is only tracked at the other quality", () => {
      const asHq = buildTrackedItem({ ...cordial, hq: true });

      expect(validateItem({ ...cordial, hq: false }, [asHq])).toBeUndefined();
    });

    it("should give no reason when a sell price ceiling of zero is asked for", () => {
      expect(
        validateItem({ ...cordial, sellPriceCeiling: 0 }, []),
      ).toBeUndefined();
    });
  });

  describe("the target quantity", () => {
    it.each([0, -1, 1.5, Number.NaN])(
      "should give a reason for %s, which isn't a whole number of at least one",
      (targetQuantity) => {
        expect(validateItem({ ...cordial, targetQuantity }, [])).toBe(
          "Target quantity needs to be a whole number of at least 1.",
        );
      },
    );
  });

  describe("the sell price ceiling", () => {
    it.each([-1, 0.5, Number.NaN])(
      "should give a reason for %s, which isn't a whole number of gil",
      (sellPriceCeiling) => {
        expect(validateItem({ ...cordial, sellPriceCeiling }, [])).toBe(
          "Sell price ceiling needs to be a whole number of gil, or left empty.",
        );
      },
    );
  });

  describe("an item already tracked at the same quality", () => {
    it("should name the item and the quality it clashes with", () => {
      const asHq = buildTrackedItem({ ...cordial, hq: true });

      expect(validateItem({ ...cordial, hq: true }, [asHq])).toBe(
        "Cordial is already tracked as HQ.",
      );
    });

    it("should treat no quality given as NQ", () => {
      const asNq = buildTrackedItem({ ...cordial, hq: false });

      expect(validateItem(cordial, [asNq])).toBe(
        "Cordial is already tracked as NQ.",
      );
    });

    it("should not count the item the settings belong to as a duplicate of itself", () => {
      const existing = buildTrackedItem({ ...cordial, hq: true }, "cordial-hq");

      expect(
        validateItem({ ...cordial, hq: true }, [existing], "cordial-hq"),
      ).toBeUndefined();
    });

    it("should still give a reason for a quality another tracked item already has", () => {
      const beingChanged = buildTrackedItem(
        { ...cordial, hq: false },
        "cordial-nq",
      );
      const other = buildTrackedItem({ ...cordial, hq: true }, "cordial-hq");

      expect(
        validateItem(
          { ...cordial, hq: true },
          [beingChanged, other],
          "cordial-nq",
        ),
      ).toBe("Cordial is already tracked as HQ.");
    });
  });
});
