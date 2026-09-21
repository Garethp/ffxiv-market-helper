/** The most units of an item a single market board listing can hold. */
const MAX_LISTING_QUANTITY = 99;

/** Crystals are the only items with this stack size, and the only ones listed a full inventory stack at a time. */
const CRYSTAL_STACK_SIZE = 9999;

/** How many market board stacks a newly tracked item gets a consistent buy price for, unless changed. */
const DEFAULT_TARGET_STACKS = 3;

/**
 * How many units of an item make up a full market board listing, given how
 * many make up a full stack in the inventory. Neither XIVAPI nor Universalis
 * publishes this; the rule comes from comparing every marketable item's
 * stack size with the largest listings and sales Universalis has seen.
 */
export const marketBoardStackSize = (stackSize: number): number =>
  stackSize === CRYSTAL_STACK_SIZE
    ? stackSize
    : Math.min(stackSize, MAX_LISTING_QUANTITY);

/** The target quantity a newly tracked item starts with. */
export const defaultTargetQuantity = (stackSize: number): number =>
  marketBoardStackSize(stackSize) * DEFAULT_TARGET_STACKS;
