import { CachingFetcher } from "./CachingFetcher";
import {
  DEFAULT_RATE_LIMIT,
  RequestLimitedApiClient,
} from "./RequestLimitedApiClient";

const BASE_URL = "https://universalis.app/api/v2";
const WEB_BASE_URL = "https://universalis.app";

// Universalis allows up to 25 req/s and 8 concurrent requests; DEFAULT_RATE_LIMIT stays well under that to be a good citizen.
const rateLimitedClient = new RequestLimitedApiClient(DEFAULT_RATE_LIMIT);
// A short cache means independent rows that happen to want the same data (e.g. two buying
// characters checking the same item's sell price) don't double up on requests.
const client = new CachingFetcher(rateLimitedClient, { ttlMs: 30_000 });

// A higher-throughput client used only for the bulk item-velocity scan (see
// fetchSaleVelocityBatch) — the flip table's conservative limits would make scanning every
// marketable item take much longer than necessary. It's deliberately separate and uncached: a
// scan never repeats the same batch of item IDs, so caching wouldn't help.
const bulkScanClient = new RequestLimitedApiClient({
  maxConcurrent: 8,
  maxRequestsPerSecond: 25,
});

/** Pauses the bulk item-velocity scan — batches already in flight still finish, but no new ones start until resumed. */
export const pauseBulkScan = (): void => {
  bulkScanClient.pause();
};

export const resumeBulkScan = (): void => {
  bulkScanClient.resume();
};

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
  options: { listings: number; entries: number; statsWithinMs?: number },
): Promise<UniversalisMarketData> => {
  const { listings, entries, statsWithinMs } = options;
  const statsWithinParam =
    statsWithinMs !== undefined ? `&statsWithin=${statsWithinMs}` : "";
  const url = `${BASE_URL}/${encodeURIComponent(worldOrDataCenter)}/${itemId}?listings=${listings}&entries=${entries}${statsWithinParam}`;

  const response = await client.fetch(url);
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
export const fetchTaxRates = async (world: string): Promise<TaxRatesByCity> => {
  const url = `${BASE_URL}/tax-rates?world=${encodeURIComponent(world)}`;

  const response = await client.fetch(url);
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
  options: { entries: number; statsWithinMs?: number },
): Promise<ItemSaleVelocity[]> => {
  if (itemIds.length === 0) return [];
  if (itemIds.length > BULK_SALE_VELOCITY_BATCH_SIZE) {
    throw new Error(
      `Cannot request more than ${BULK_SALE_VELOCITY_BATCH_SIZE} items in a single bulk request`,
    );
  }

  const { entries, statsWithinMs } = options;
  const statsWithinParam =
    statsWithinMs !== undefined ? `&statsWithin=${statsWithinMs}` : "";
  const url = `${BASE_URL}/${encodeURIComponent(worldOrDataCenter)}/${itemIds.join(",")}?listings=0&entries=${entries}${statsWithinParam}`;

  const response = await bulkScanClient.fetch(url);
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

/** The universalis.app web page showing this item's listings/history for a given world or data center. */
export const buildMarketPageUrl = (
  itemId: number,
  worldOrDataCenter: string,
): string => {
  return `${WEB_BASE_URL}/market/${itemId}?server=${encodeURIComponent(worldOrDataCenter)}`;
};
