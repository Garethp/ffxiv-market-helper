import {
  QueryObserver,
  queryOptions,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  fetchMarketData,
  fetchTaxRates,
  type TaxRatesByCity,
  type UniversalisMarketData,
} from "../api/universalis";
import {
  buildReadyAnalysis,
  calculateAverageListingPrice,
  calculateAverageSalePrice,
  calculateConsistentPrice,
  determineSellListingStatus,
  isOwnRetainerListing,
  resolveSellTaxRate,
  type WorldRetainer,
} from "../utils/pricing";
import { findDataCentersForRegion } from "../utils/worldDirectory";
import type {
  Character,
  ProfitRow,
  RegionInfo,
  RowAnalysis,
  TrackedItem,
  TradingParameters,
} from "../types";

/** The target quantity assumed when pricing an item that isn't tracked, and so has no target quantity of its own. */
export const UNTRACKED_ITEM_TARGET_QUANTITY = 99;

export const pendingRow = (item: TrackedItem): ProfitRow => {
  return {
    item,
    analysis: { status: "pending" },
    lastSuccessAt: null,
    lastAttemptFailed: false,
    lastErrorMessage: null,
  };
};

/** The market data a row's analysis is calculated from, for one item bought via one region. */
export interface RowMarketData {
  sell: UniversalisMarketData;
  sellTaxRates: TaxRatesByCity;
  /** One entry per data center in the buying region, in directory order. */
  buy: { dataCenter: string; data: UniversalisMarketData }[];
}

/**
 * How long a Universalis response is reused for an identical request, so
 * rows that want the same data at around the same time (e.g. every tracked
 * item's sell world tax rates, or one item's sell prices for each buying
 * region) don't double up on requests.
 */
const UNIVERSALIS_REUSE_MS = 30_000;

/** Settles the way `promise` does, unless the signal is aborted first, in which case it rejects with the abort reason straight away. */
const unlessAborted = <T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const onAbort = () => reject(signal?.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal?.removeEventListener("abort", onAbort));
  });

/**
 * Fetches a Universalis response through the query cache, reusing it while
 * it's fresh and sharing a request that's already in flight with every row
 * that wants the same data. Aborting `signal` stops this row waiting on it,
 * and cancels the request once no other row is waiting on it either.
 */
const fetchShared = async <T>(
  client: QueryClient,
  queryKey: QueryKey,
  request: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> => {
  const options = queryOptions({
    queryKey,
    queryFn: ({ signal: requestSignal }) => request(requestSignal),
    staleTime: UNIVERSALIS_REUSE_MS,
  });
  // TanStack Query cancels a request once nothing is observing it, so each row observes the
  // request for as long as it's waiting on it.
  const stopObserving = new QueryObserver(client, options).subscribe(() => {});
  try {
    return await unlessAborted(client.fetchQuery(options), signal);
  } finally {
    stopObserving();
  }
};

/**
 * Fetches the market data for a single item bought via a single region and
 * sold through the given character. What's fetched doesn't depend on the
 * item's quality, target quantity or sell price ceiling — those only affect
 * how it's analyzed. Aborting `signal` cancels whichever of its requests no
 * other row is waiting on.
 */
export const fetchRowMarketData = async (
  client: QueryClient,
  itemId: number,
  region: string,
  sellingCharacter: Character,
  regions: RegionInfo[],
  params: TradingParameters,
  signal?: AbortSignal,
): Promise<RowMarketData> => {
  const marketData = (
    worldOrDataCenter: string,
    options: { listings: number; entries: number; statsWithinMs?: number },
  ) =>
    fetchShared(
      client,
      ["marketData", worldOrDataCenter, itemId, options],
      (requestSignal) =>
        fetchMarketData(worldOrDataCenter, itemId, {
          ...options,
          signal: requestSignal,
        }),
      signal,
    );

  const sellWorld = sellingCharacter.homeWorld;
  const [sell, sellTaxRates, buy] = await Promise.all([
    marketData(sellWorld, {
      listings: params.sellListingsFetchCount,
      entries: params.sellHistoryFetchCount,
      statsWithinMs: params.saleVelocityWindowMs,
    }),
    fetchShared(
      client,
      ["taxRates", sellWorld],
      (requestSignal) => fetchTaxRates(sellWorld, { signal: requestSignal }),
      signal,
    ),
    Promise.all(
      findDataCentersForRegion(region, regions).map(async (dataCenter) => ({
        dataCenter,
        data: await marketData(dataCenter, {
          listings: params.buyListingsFetchCount,
          entries: 0,
        }),
      })),
    ),
  ]);
  return { sell, sellTaxRates, buy };
};

/** Calculates the profit analysis for a single item from its already-fetched market data. */
export const analyzeRow = (
  marketData: RowMarketData,
  item: TrackedItem,
  sellingCharacter: Character,
  ownRetainers: WorldRetainer[],
  params: TradingParameters,
): RowAnalysis => {
  const sellWorld = sellingCharacter.homeWorld;
  const matchesQuality = <T extends { hq: boolean }>(entry: T) =>
    (item.hq ?? false) === entry.hq;

  const sellTaxRate = resolveSellTaxRate(
    sellingCharacter.retainers,
    marketData.sellTaxRates,
    params.defaultSellTaxRate,
  );

  // A single-world query never sets worldName on its listings (it's redundant — every listing
  // is on sellWorld already), but isOwnRetainerListing needs it to recognize our own retainer.
  const sellQualityListings = marketData.sell.listings
    .filter(matchesQuality)
    .map((listing) => ({
      ...listing,
      worldName: listing.worldName ?? sellWorld,
    }));
  const sellHistory = calculateAverageSalePrice(
    marketData.sell.recentHistory.filter(matchesQuality),
    params.saleSampleSize,
  );
  const sellListings = calculateAverageListingPrice(
    sellQualityListings,
    params.saleSampleSize,
  );
  const sellListingStatus = determineSellListingStatus(
    sellQualityListings,
    ownRetainers,
    params.undercutListingThreshold,
  );
  const saleVelocityPerDay = item.hq
    ? marketData.sell.hqSaleVelocity
    : marketData.sell.nqSaleVelocity;

  let best: {
    dataCenter: string;
    price: NonNullable<ReturnType<typeof calculateConsistentPrice>>;
  } | null = null;
  for (const { dataCenter, data } of marketData.buy) {
    const buyableListings = data.listings
      .filter(matchesQuality)
      .filter((listing) => !isOwnRetainerListing(listing, ownRetainers));
    const price = calculateConsistentPrice(
      buyableListings,
      item.targetQuantity,
    );
    if (price && (!best || price.pricePerUnit < best.price.pricePerUnit)) {
      best = { dataCenter, price };
    }
  }

  return buildReadyAnalysis(
    best?.dataCenter ?? marketData.buy[0]?.dataCenter ?? "",
    best?.price ?? null,
    sellHistory,
    sellListings,
    item.stackSize,
    item.sellPriceCeiling,
    saleVelocityPerDay,
    {
      buyTaxRate: params.buyTaxRate,
      sellTaxRate,
      gapThresholdMultiplier: params.gapThresholdMultiplier,
    },
    sellListingStatus,
  );
};
