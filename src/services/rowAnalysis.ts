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

/** The outcome of one fetch attempt. A failure never carries pricing data — see ProfitRow's docs for why. */
export type FetchOutcome =
  | { success: true; analysis: RowAnalysis }
  | { success: false; message: string };

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

/**
 * Turns one fetch attempt's outcome into a row's next state. A success
 * replaces the row entirely; a failure never overwrites previously-known-good
 * analysis — it only stamps that the latest attempt failed, preserving
 * whatever the row already had (or a pending row, if it had nothing yet).
 */
export const applyFetchOutcome = (
  previous: ProfitRow | undefined,
  item: TrackedItem,
  outcome: FetchOutcome,
): ProfitRow => {
  if (outcome.success) {
    return {
      item,
      analysis: outcome.analysis,
      lastSuccessAt: Date.now(),
      lastAttemptFailed: false,
      lastErrorMessage: null,
    };
  }
  return {
    ...(previous ?? pendingRow(item)),
    lastAttemptFailed: true,
    lastErrorMessage: outcome.message,
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
 * Fetches the market data for a single item bought via a single region and
 * sold through the given character. What's fetched doesn't depend on the
 * item's quality, target quantity or sell price ceiling — those only affect
 * how it's analyzed.
 */
export const fetchRowMarketData = async (
  itemId: number,
  region: string,
  sellingCharacter: Character,
  regions: RegionInfo[],
  params: TradingParameters,
): Promise<RowMarketData> => {
  const sellWorld = sellingCharacter.homeWorld;
  const [sell, sellTaxRates, buy] = await Promise.all([
    fetchMarketData(sellWorld, itemId, {
      listings: params.sellListingsFetchCount,
      entries: params.sellHistoryFetchCount,
      statsWithinMs: params.saleVelocityWindowMs,
    }),
    fetchTaxRates(sellWorld),
    Promise.all(
      findDataCentersForRegion(region, regions).map(async (dataCenter) => ({
        dataCenter,
        data: await fetchMarketData(dataCenter, itemId, {
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

/** Fetches and computes the profit analysis for a single item bought via a single region. */
export const fetchRowAnalysis = async (
  item: TrackedItem,
  region: string,
  sellingCharacter: Character,
  regions: RegionInfo[],
  ownRetainers: WorldRetainer[],
  params: TradingParameters,
): Promise<FetchOutcome> => {
  try {
    const marketData = await fetchRowMarketData(
      item.itemId,
      region,
      sellingCharacter,
      regions,
      params,
    );
    return {
      success: true,
      analysis: analyzeRow(
        marketData,
        item,
        sellingCharacter,
        ownRetainers,
        params,
      ),
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
};
