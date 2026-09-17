import { fetchMarketData, fetchTaxRates } from "../api/universalis";
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
  FlipRow,
  RegionInfo,
  RowAnalysis,
  TrackedItem,
  TradingParameters,
} from "../types";

/** The outcome of one fetch attempt. A failure never carries pricing data — see FlipRow's docs for why. */
export type FetchOutcome =
  | { success: true; analysis: RowAnalysis }
  | { success: false; message: string };

export const pendingRow = (item: TrackedItem): FlipRow => {
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
  previous: FlipRow | undefined,
  item: TrackedItem,
  outcome: FetchOutcome,
): FlipRow => {
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

/** Fetches and computes the flip analysis for a single item bought via a single region. */
export const fetchRowAnalysis = async (
  item: TrackedItem,
  region: string,
  sellingCharacter: Character,
  regions: RegionInfo[],
  ownRetainers: WorldRetainer[],
  params: TradingParameters,
): Promise<FetchOutcome> => {
  const sellWorld = sellingCharacter.homeWorld;
  const dataCenters = findDataCentersForRegion(region, regions);

  const matchesQuality = <T extends { hq: boolean }>(entry: T) =>
    (item.hq ?? false) === entry.hq;

  try {
    const [sellData, taxRates, buyResults] = await Promise.all([
      fetchMarketData(sellWorld, item.itemId, {
        listings: params.sellListingsFetchCount,
        entries: params.sellHistoryFetchCount,
        statsWithinMs: params.saleVelocityWindowMs,
      }),
      fetchTaxRates(sellWorld),
      Promise.all(
        dataCenters.map(async (dataCenter) => ({
          dataCenter,
          data: await fetchMarketData(dataCenter, item.itemId, {
            listings: params.buyListingsFetchCount,
            entries: 0,
          }),
        })),
      ),
    ]);

    const sellTaxRate = resolveSellTaxRate(
      sellingCharacter.retainers,
      taxRates,
      params.defaultSellTaxRate,
    );

    // A single-world query never sets worldName on its listings (it's redundant — every listing
    // is on sellWorld already), but isOwnRetainerListing needs it to recognize our own retainer.
    const sellQualityListings = sellData.listings
      .filter(matchesQuality)
      .map((listing) => ({
        ...listing,
        worldName: listing.worldName ?? sellWorld,
      }));
    const sellHistory = calculateAverageSalePrice(
      sellData.recentHistory.filter(matchesQuality),
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
      ? sellData.hqSaleVelocity
      : sellData.nqSaleVelocity;

    let best: {
      dataCenter: string;
      price: NonNullable<ReturnType<typeof calculateConsistentPrice>>;
    } | null = null;
    for (const { dataCenter, data } of buyResults) {
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

    const analysis = buildReadyAnalysis(
      best?.dataCenter ?? dataCenters[0] ?? "",
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
    return { success: true, analysis };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
};
