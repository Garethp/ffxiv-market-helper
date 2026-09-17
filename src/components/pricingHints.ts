/** What an item's pricing settings mean, explained the same way wherever they can be changed. */
export const pricingHints = {
  targetQuantity:
    "The quantity of items to consider when calculating the average buy price. Higher numbers are useful for weeding out small quantities that are underpriced, but larger numbers may be difficult to find for some  items.",
  sellPriceCeiling:
    "The most you'd sell this item for. This is mostly if you don't want to gouge buyers due to price spikes. Leave this empty if you always want to sell at the highest possible price.",
};

/** How each column of a profit table is worked out, explained beside its header. */
export const profitColumnHints = {
  buyPrice:
    "The average price per unit over the cheapest listings, enough to fill the item's target quantity. For example, a target quantity of 1 only counts the cheapest listing, while a target quantity of 297 (3 stacks of 99) averages the listings that make up 297 units.",
  /** How far above recent sales the listings have to be to count as a gap comes from the trading parameters, so the two can't drift apart. */
  sellPrice: (gapThresholdMultiplier: number) =>
    `The average price of recent sales, unless all the current listings are at least ${Math.round((gapThresholdMultiplier - 1) * 100)}% higher than that. Then the item is highlighted as having a "gap" you can take advantage of, and the sell price is the average of the cheapest current listings instead (or your sell price ceiling, if you have one).`,
  profitPerItem:
    "Profit after buyer's and seller's tax, using the cities your retainers are in.",
  expectedProfitPerDay:
    "The profit per item multiplied by how many sold in the last 24 hours.",
};
