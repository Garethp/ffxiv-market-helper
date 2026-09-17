/** An item we want to track for trading opportunities. */
export interface TrackedItem {
  itemId: number;
  name: string;
  /** Whether to price this item by its HQ listings/sales rather than NQ. */
  hq?: boolean;
  /** Units per full stack of this item, used only for the "profit per stack" display metric. */
  stackSize: number;
  /**
   * How many units to get a consistent buy price for. For most items this is
   * a small multiple of stackSize (e.g. 3 stacks), but that's a per-item
   * judgment call, not a universal rule — it wouldn't make sense the same way
   * for something like crafting shards, so each item sets its own.
   */
  targetQuantity: number;
  /**
   * The most you'd ever actually list this item for, regardless of what the
   * market suggests. Caps the sell price used for profit calculations — e.g.
   * if a supply gap means the only current listings are absurdly high,
   * pricing off that number isn't useful since it's not a price you'd
   * actually sell at. Omit for no ceiling.
   */
  sellPriceCeiling?: number;
}

/**
 * A retainer that actually posts market listings — characters themselves
 * don't sell anything, their retainers do. A character has 0–2 of these.
 * A retainer doesn't carry its own world: it's always tied to its owning
 * character's home world, so that's looked up via the character instead.
 */
export interface Retainer {
  /** The retainer's name, used to recognize our own listings on the market board. */
  name: string;
  /** The market board city this retainer is parked in — determines the tax rate charged there. */
  city: string;
}

/**
 * A character in our roster. Every character can be used as a buying
 * source (its home world's region determines what it can reach), and
 * whichever one is the Current Character is the one we sell through. The
 * Default Character (ConfigService.getDefaultCharacterName) is the Current
 * Character until another is picked. Which data centers a character can
 * reach isn't stored here: it's inferred from `homeWorld` via the region
 * directory (ConfigService.getRegions), since a character always has access
 * to every data center in their own region.
 */
export interface Character {
  name: string;
  homeWorld: string;
  /** This character's own retainers. For the Current Character, these determine the sell world's tax rate; for any other, they're excluded from buy-price calculations so we never end up buying from ourselves. */
  retainers: Retainer[];
  /** Optional caveat shown when this character is used as a buying source (e.g. logistics friction to move goods to the Current Character). */
  note?: string;
}

/** A named data center within a region, and the worlds that belong to it. */
export interface DataCenterInfo {
  name: string;
  worlds: string[];
}

/** An FFXIV region and the data centers within it. Static reference data — not something any one character's config should duplicate. */
export interface RegionInfo {
  name: string;
  dataCenters: DataCenterInfo[];
}

/** Tunable parameters governing how items are priced and refreshed. */
export interface TradingParameters {
  buyTaxRate: number;
  /**
   * The sell tax rate assumed when the selling character has no retainers
   * (or none with a known city rate) to resolve a real one from — e.g. a
   * freshly-rolled character you haven't gotten around to placing retainers
   * for yet, but still want to scout prices through. 0.05 is the game's
   * standard base retainer tax rate before any city discount.
   */
  defaultSellTaxRate: number;
  /**
   * How much higher the cheapest current listings have to be over the recent
   * sale average before we consider it a supply gap (nobody undercutting the
   * price people were actually paying) rather than just normal price noise.
   */
  gapThresholdMultiplier: number;
  /** How many recent entries to average for both the sale-history and current-listings prices. */
  saleSampleSize: number;
  /** How many listings to fetch per buy-side data center request. */
  buyListingsFetchCount: number;
  /** How many current listings to fetch on the sell server. */
  sellListingsFetchCount: number;
  /**
   * How many recent sale history entries to fetch on the sell server. Also
   * doubles as the data behind sale velocity: Universalis only sums sales
   * within saleVelocityWindowMs among the entries actually fetched, so this
   * has to be large enough to cover every sale in that window or velocity
   * gets silently understated. Needs to comfortably exceed saleSampleSize.
   */
  sellHistoryFetchCount: number;
  /**
   * The window sale velocity is measured over. Kept short (not a longer
   * "weekly average") specifically so sellHistoryFetchCount can reliably
   * cover every sale within it, even for fast-moving items — a longer
   * window would need an impractically large fetch to stay accurate rather
   * than silently truncating.
   */
  saleVelocityWindowMs: number;
  /** How often each row refreshes itself under normal conditions. */
  refreshIntervalMs: number;
  /** How long to wait before a single retry after a row's fetch fails. */
  retryDelayMs: number;
  /** How stale a row's last successful data can get (while fetches keep failing) before we warn about it. */
  staleWarningThresholdMs: number;
  /**
   * How many of the cheapest current listings count as "competitive". If our
   * own retainer's listing for an item isn't among them, it's flagged as
   * undercut.
   */
  undercutListingThreshold: number;
}

/** One of the cheapest listings we'd need to beat to be competitive again. */
export interface CompetingListing {
  pricePerUnit: number;
  quantity: number;
}

/**
 * Where our own retainer's listing for an item ranks against current
 * competition on the Selling Character's world, cheapest first.
 */
export type SellListingStatus =
  | { state: "not-listed" }
  | { state: "competitive"; rank: number }
  | {
      state: "undercut";
      ourPricePerUnit: number;
      rank: number;
      /** The cheapest other-seller listings, up to undercutListingThreshold. */
      cheaperListings: CompetingListing[];
    };

/** Result of costing out enough listings to fill a target quantity. */
export interface ConsistentPrice {
  /** Weighted-average price per unit across the listings needed to fill the target quantity. */
  pricePerUnit: number;
  /** How much of the target quantity was actually available across all listings. */
  quantityFilled: number;
  /** Whether enough listings existed to fill the full target quantity. */
  fullyFilled: boolean;
  /** The world the cheapest listing(s) came from (first listing consumed). */
  cheapestWorld: string | null;
}

/** The priced-out result of a successful profit analysis. */
export interface ProfitPricing {
  /** The data center within the buying character's region where the best price was found. */
  buyDataCenter: string;
  buy: ConsistentPrice | null;
  sellPricePerUnit: number | null;
  sellSampleSize: number;
  /** Whether sellPricePerUnit came from recent sale history or from current listings. */
  sellPriceSource: "history" | "listings" | null;
  /** True when sellPricePerUnit was brought down to the item's sellPriceCeiling because the market price exceeded it. */
  sellPriceCapped: boolean;
  /** True when current listings sit well above recent sale prices — a gap we could undercut into. */
  gapDetected: boolean;
  /** Average units of this item actually sold per day recently, for its tracked quality — how much of it the market can actually absorb. */
  saleVelocityPerDay: number;
  effectiveBuyPricePerUnit: number | null;
  effectiveSellPricePerUnit: number | null;
  profitPerItem: number | null;
  profitPerStack: number | null;
  /** Profit per item scaled by actual daily sale velocity, rather than assuming the whole target quantity sells. The realistic "is this worth doing" number for low-throughput items. */
  expectedProfitPerDay: number | null;
  /** Where our own retainer's listing for this item stands against current competition on the sell world. */
  sellListingStatus: SellListingStatus;
}

/**
 * The state of a single item/character row's analysis. `pending` means we
 * haven't fetched yet; `ready` means we successfully fetched (its nested
 * fields can still legitimately be null, e.g. no listings currently exist —
 * that's a real market state, not a loading state). There's no `error`
 * state here deliberately: a failed fetch never changes what's displayed —
 * see ProfitRow's lastAttemptFailed/lastErrorMessage for that instead.
 */
export type RowAnalysis =
  { status: "pending" } | ({ status: "ready" } & ProfitPricing);

/** A single item's profit analysis for a single buying character. */
export interface ProfitRow {
  item: TrackedItem;
  analysis: RowAnalysis;
  /** When the last successful fetch completed, or null if one never has. */
  lastSuccessAt: number | null;
  /** True if the most recent fetch attempt failed. Never affects `analysis` — a failure never overwrites previously-known-good data. */
  lastAttemptFailed: boolean;
  /** The error from the most recent failed attempt, for a tooltip. Cleared on the next success. */
  lastErrorMessage: string | null;
}

/** A row paired with whether it's actively refreshing, for display. */
export interface DisplayRow {
  row: ProfitRow;
  /** True while a fetch for this specific row is in flight. */
  isRefreshing: boolean;
}
