import type { PricedItem, TrackedItem } from "../../types";

/**
 * Why the item can't be tracked as it is alongside `trackedItems`, worded for
 * the user to read, or nothing if there's no reason. `excludingId` is the
 * tracked item the settings belong to, which isn't a duplicate of itself.
 */
export const validateItem = (
  item: PricedItem,
  trackedItems: TrackedItem[],
  excludingId?: string,
): string | undefined => {
  if (!Number.isInteger(item.targetQuantity) || item.targetQuantity < 1) {
    return "Target quantity needs to be a whole number of at least 1.";
  }
  const ceiling = item.sellPriceCeiling;
  if (ceiling !== undefined && (!Number.isInteger(ceiling) || ceiling < 0)) {
    return "Sell price ceiling needs to be a whole number of gil, or left empty.";
  }
  const hq = item.hq ?? false;
  const isAlreadyTracked = trackedItems.some(
    (other) =>
      other.id !== excludingId &&
      other.itemId === item.itemId &&
      (other.hq ?? false) === hq,
  );

  if (isAlreadyTracked) {
    return `${item.name} is already tracked as ${hq ? "HQ" : "NQ"}.`;
  }

  return undefined;
};
