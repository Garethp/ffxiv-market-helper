import { RequestLimitedApiClient } from "./RequestLimitedApiClient";
import { CrossTabRequestLimiter } from "../requestLimiting/CrossTabRequestLimiter";

const BASE_URL = "https://universalis.app/api/v2";
const WEB_BASE_URL = "https://universalis.app";
const ASSETS_BASE_URL =
  "https://universalis-ffxiv.github.io/universalis-assets";

// Universalis allows up to 25 req/s and 8 concurrent requests. This stays below that so there's
// room left over for using the Universalis website at the same time. Every request to it, from
// every open tab, shares this one budget.
const limiter = new CrossTabRequestLimiter("universalis", {
  maxConcurrent: 5,
  maxRequestsPerSecond: 15,
});

const client = new RequestLimitedApiClient(limiter, "interactive");

// Used only for bulk requests covering many items (see fetchSaleVelocityBatch and
// fetchRegionListings). Background priority lets it use the whole budget while nothing else
// needs it, without starving pages someone is looking at.
const backgroundClient = new RequestLimitedApiClient(limiter, "background");

export interface UniversalisListing {
  pricePerUnit: number;
  quantity: number;
  worldName?: string;
  hq: boolean;
  /** The retainer's name — used to recognize our own listings so we can exclude them from buy-price calculations. */
  retainerName: string;
}

export interface UniversalisHistoryEntry {
  pricePerUnit: number;
  quantity: number;
  worldName?: string;
  timestamp: number;
  hq: boolean;
}

export interface UniversalisMarketData {
  itemID: number;
  listings: UniversalisListing[];
  recentHistory: UniversalisHistoryEntry[];
  /**
   * Average units sold per day, for each quality, over whichever window was
   * requested (statsWithinMs, or Universalis' own default if omitted).
   * Only accurate if `entries` was large enough to fetch every sale within
   * that window — Universalis computes this from the returned history
   * entries, not independently of them, so a too-small `entries` silently
   * understates it.
   */
  nqSaleVelocity: number;
  hqSaleVelocity: number;
}

/**
 * Fetches current listings and recent sale history for a single item on a
 * given world or data center.
 */
export const fetchMarketData = async (
  worldOrDataCenter: string,
  itemId: number,
  options: {
    listings: number;
    entries: number;
    statsWithinMs?: number;
    signal?: AbortSignal;
  },
): Promise<UniversalisMarketData> => {
  const { listings, entries, statsWithinMs, signal } = options;
  const statsWithinParam =
    statsWithinMs !== undefined ? `&statsWithin=${statsWithinMs}` : "";
  const url = `${BASE_URL}/${encodeURIComponent(worldOrDataCenter)}/${itemId}?listings=${listings}&entries=${entries}${statsWithinParam}`;

  const response = await client.fetch(url, { signal });
  if (!response.ok) {
    throw new Error(
      `Universalis request failed (${response.status}) for item ${itemId} on ${worldOrDataCenter}`,
    );
  }

  return (await response.json()) as UniversalisMarketData;
};

/** Retainer tax rates for a world, as percentages (e.g. 5 means 5%), keyed by market board city name. */
export type TaxRatesByCity = Record<string, number>;

/** Fetches current retainer tax rates per market board city for a given world. */
export const fetchTaxRates = async (
  world: string,
  signal?: AbortSignal,
): Promise<TaxRatesByCity> => {
  const url = `${BASE_URL}/tax-rates?world=${encodeURIComponent(world)}`;

  const response = await client.fetch(url, { signal });
  if (!response.ok) {
    throw new Error(
      `Universalis tax-rates request failed (${response.status}) for world ${world}`,
    );
  }

  return (await response.json()) as TaxRatesByCity;
};

/** Every item ID Universalis has ever seen listed or sold — the scope of a full market scan. */
export const fetchMarketableItemIds = async (): Promise<number[]> => {
  const response = await client.fetch(`${BASE_URL}/marketable`);
  if (!response.ok) {
    throw new Error(
      `Universalis marketable-items request failed (${response.status})`,
    );
  }
  return (await response.json()) as number[];
};

export interface ItemSaleVelocity {
  itemId: number;
  nqSaleVelocity: number;
  hqSaleVelocity: number;
}

/**
 * The most item IDs to request in a single fetchSaleVelocityBatch call.
 * Universalis accepts up to 100 IDs per request, but a batch that large
 * reliably hits its ~10s gateway timeout once each item's sale history is
 * factored in — verified empirically, since the docs don't call this out.
 * 20 comfortably clears that timeout even under concurrent load.
 */
export const BULK_SALE_VELOCITY_BATCH_SIZE = 20;

/**
 * Fetches sale velocity for up to BULK_SALE_VELOCITY_BATCH_SIZE items at
 * once, on a given world or data center. Listings aren't requested — a scan
 * only needs velocity — to keep each batch's response lean. An item with no
 * data for the queried scope is simply absent from the result.
 */
export const fetchSaleVelocityBatch = async (
  worldOrDataCenter: string,
  itemIds: number[],
  options: { entries: number; statsWithinMs?: number; signal?: AbortSignal },
): Promise<ItemSaleVelocity[]> => {
  if (itemIds.length === 0) return [];
  if (itemIds.length > BULK_SALE_VELOCITY_BATCH_SIZE) {
    throw new Error(
      `Cannot request more than ${BULK_SALE_VELOCITY_BATCH_SIZE} items in a single bulk request`,
    );
  }

  const { entries, statsWithinMs, signal } = options;
  const statsWithinParam =
    statsWithinMs !== undefined ? `&statsWithin=${statsWithinMs}` : "";
  const url = `${BASE_URL}/${encodeURIComponent(worldOrDataCenter)}/${itemIds.join(",")}?listings=0&entries=${entries}${statsWithinParam}`;

  const response = await backgroundClient.fetch(url, { signal });
  if (!response.ok) {
    throw new Error(
      `Universalis bulk request failed (${response.status}) for ${itemIds.length} items on ${worldOrDataCenter}`,
    );
  }

  const data = (await response.json()) as {
    items: Record<string, { nqSaleVelocity: number; hqSaleVelocity: number }>;
  };
  return Object.entries(data.items).map(([itemId, item]) => ({
    itemId: Number(itemId),
    nqSaleVelocity: item.nqSaleVelocity,
    hqSaleVelocity: item.hqSaleVelocity,
  }));
};

/** A listing of an item somewhere in a region, and which world it's on. */
export interface RegionListing {
  pricePerUnit: number;
  worldName: string;
}

/**
 * The most item IDs to request in a single fetchRegionListings call.
 * Universalis' own limit; with only a listing's price and world and no
 * history, a full batch of every listing across a region comes back in well
 * under a second — verified against Europe, where it came to ~12,000 listings
 * and ~550KB.
 */
export const REGION_LISTINGS_BATCH_SIZE = 100;

/** Regions whose name Universalis spells differently; any other region's name is the same there. */
const UNIVERSALIS_REGION_NAMES: Record<string, string> = {
  "North America": "North-America",
};

const toUniversalisRegionName = (region: string): string =>
  UNIVERSALIS_REGION_NAMES[region] ?? region;

/**
 * Fetches every current listing of each item anywhere in a region, cheapest
 * first. An item with no listings there is absent from the result. Uses the
 * bulk scan's background priority, since it's one of many requests made to
 * price a whole list of items.
 */
export const fetchRegionListings = async (
  region: string,
  itemIds: number[],
  signal?: AbortSignal,
): Promise<Map<number, RegionListing[]>> => {
  if (itemIds.length === 0) return new Map();
  if (itemIds.length > REGION_LISTINGS_BATCH_SIZE) {
    throw new Error(
      `Cannot request more than ${REGION_LISTINGS_BATCH_SIZE} items in a single region-listings request`,
    );
  }

  // Universalis answers a request for one item in a different shape than a request for several.
  const isSingleItem = itemIds.length === 1;
  const listingFields = ["pricePerUnit", "worldName"]
    .map((field) => `${isSingleItem ? "" : "items."}listings.${field}`)
    .join(",");
  // Leaving out the number of listings asks for all of them, which Universalis gives cheapest first.
  const url = `${BASE_URL}/${encodeURIComponent(toUniversalisRegionName(region))}/${itemIds.join(",")}?entries=0&fields=${listingFields}`;

  const response = await backgroundClient.fetch(url, { signal });
  // An item Universalis doesn't know is left out of a response for several, but is a 404 on its own.
  if (isSingleItem && response.status === 404) return new Map();
  if (!response.ok) {
    throw new Error(
      `Universalis region-listings request failed (${response.status}) for ${itemIds.length} items in ${region}`,
    );
  }

  type ItemListings = { listings: RegionListing[] };
  const data = (await response.json()) as
    ItemListings | { items: Record<string, ItemListings> };
  const itemListings: [number, ItemListings][] =
    "items" in data
      ? Object.entries(data.items).map(([itemId, item]) => [
          Number(itemId),
          item,
        ])
      : [[itemIds[0], data]];

  return new Map(
    itemListings
      .filter(([, { listings }]) => listings.length > 0)
      .map(([itemId, { listings }]) => [itemId, listings]),
  );
};

/**
 * The item's icon, from the asset set Universalis' own pages use. Only items
 * that can be sold on the market board have one.
 */
export const buildItemIconUrl = (itemId: number): string =>
  `${ASSETS_BASE_URL}/icon2x/${itemId}.png`;

/** The universalis.app web page showing this item's listings/history for a given world or data center. */
export const buildMarketPageUrl = (
  itemId: number,
  worldOrDataCenter: string,
): string => {
  return `${WEB_BASE_URL}/market/${itemId}?server=${encodeURIComponent(worldOrDataCenter)}`;
};
