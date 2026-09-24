import type {
  TaxRatesByCity,
  UniversalisHistoryEntry,
  UniversalisListing,
} from "../api/universalis";
import type {
  ConsistentPrice,
  Retainer,
  RowAnalysis,
  SellListingStatus,
} from "../types";
import { calculateMarketBoardStackSize } from "./marketBoardStack";

/** A retainer resolved with the world it's actually on — Retainer itself doesn't carry this, since it's always its owning character's home world. */
export interface WorldRetainer {
  name: string;
  world: string;
}

/** True if a listing was posted by one of the given retainers — used to keep us from buying from ourselves. */
export const isOwnRetainerListing = (
  listing: UniversalisListing,
  ownRetainers: WorldRetainer[],
): boolean => {
  return ownRetainers.some(
    (retainer) =>
      retainer.world === listing.worldName &&
      retainer.name === listing.retainerName,
  );
};

/**
 * The tax rate we'd actually pay selling through the best (lowest-tax) of
 * the given retainers, as a fraction (e.g. 0.05 for 5%). Falls back to
 * `defaultRate` if none of the retainers have a known rate for their city —
 * most commonly because there are no retainers at all yet (a character you
 * want to scout prices through before you've gotten around to placing
 * retainers for them).
 */
export const resolveSellTaxRate = (
  retainers: Retainer[],
  taxRatesByCity: TaxRatesByCity,
  defaultRate: number,
): number => {
  const rates = retainers
    .map((retainer) => taxRatesByCity[retainer.city])
    .filter((rate): rate is number => rate !== undefined);

  return rates.length === 0 ? defaultRate : Math.min(...rates) / 100;
};

/**
 * Walks listings from cheapest to most expensive, accumulating quantity until
 * `targetQuantity` is reached, and returns the weighted-average price per
 * unit across the listings actually needed to fill it. This represents the
 * price you can consistently buy at, rather than just the single cheapest
 * listing (which may only cover a handful of units).
 */
export const calculateConsistentPrice = (
  listings: UniversalisListing[],
  targetQuantity: number,
): ConsistentPrice | undefined => {
  if (listings.length === 0) return;

  const sorted = [...listings].sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  let remaining = targetQuantity;
  let totalCost = 0;
  let quantityFilled = 0;
  const cheapestWorld = sorted[0].worldName;

  for (const listing of sorted) {
    if (remaining <= 0) break;
    const quantityTaken = Math.min(remaining, listing.quantity);
    totalCost += quantityTaken * listing.pricePerUnit;
    quantityFilled += quantityTaken;
    remaining -= quantityTaken;
  }

  return {
    pricePerUnit: totalCost / quantityFilled,
    quantityFilled,
    fullyFilled: remaining <= 0,
    cheapestWorld,
  };
};

/** Average price per unit across the most recent sale history entries. */
export const calculateAverageSalePrice = (
  history: UniversalisHistoryEntry[],
  sampleSize: number,
): number | undefined => {
  if (history.length === 0) return;

  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const sample = sorted.slice(0, sampleSize);
  return (
    sample.reduce((sum, entry) => sum + entry.pricePerUnit, 0) / sample.length
  );
};

/** Average price per unit across the cheapest currently-listed entries. */
export const calculateAverageListingPrice = (
  listings: UniversalisListing[],
  sampleSize: number,
): number | undefined => {
  if (listings.length === 0) return;

  const sorted = [...listings].sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  const sample = sorted.slice(0, sampleSize);
  return (
    sample.reduce((sum, listing) => sum + listing.pricePerUnit, 0) /
    sample.length
  );
};

/**
 * Ranks our own retainer's listing (the cheapest one, if we have more than
 * one) against every current listing on the sell world. Not being among the
 * cheapest `undercutListingThreshold` listings means someone else has taken
 * over the top of the list — the returned cheapestListings (the first
 * `undercutListingsShown`, ours included, so it's clear where we sit) are
 * what we'd need to beat.
 */
export const determineSellListingStatus = (
  listings: UniversalisListing[],
  ownRetainers: WorldRetainer[],
  undercutListingThreshold: number,
  undercutListingsShown: number,
): SellListingStatus => {
  const sorted = [...listings].sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  const ownIndex = sorted.findIndex((listing) =>
    isOwnRetainerListing(listing, ownRetainers),
  );
  if (ownIndex === -1) return { state: "not-listed" };

  const rank = ownIndex + 1;
  if (rank <= undercutListingThreshold) return { state: "competitive", rank };

  const cheapestListings = sorted
    .slice(0, undercutListingsShown)
    .map((listing) => ({
      pricePerUnit: listing.pricePerUnit,
      quantity: listing.quantity,
      retainerName: listing.retainerName,
      ours: isOwnRetainerListing(listing, ownRetainers),
    }));

  return {
    state: "undercut",
    ourPricePerUnit: sorted[ownIndex].pricePerUnit,
    rank,
    cheapestListings,
  };
};

/**
 * Picks which price to sell at. Normally that's the recent sale history, but
 * if the cheapest current listings sit well above what people actually paid
 * recently, nobody is undercutting toward that price anymore — that's a gap
 * we could list into, so we price off the current listings instead.
 */
const chooseSellPrice = (
  sellHistory: number | undefined,
  sellListings: number | undefined,
  gapThresholdMultiplier: number,
): {
  price?: number;
  source?: "history" | "listings";
  gapDetected: boolean;
} => {
  if (sellHistory === undefined) {
    return {
      price: sellListings,
      source: sellListings !== undefined ? "listings" : undefined,
      gapDetected: false,
    };
  }

  const gapDetected =
    sellListings !== undefined &&
    sellListings > sellHistory * gapThresholdMultiplier;

  return gapDetected
    ? { price: sellListings, source: "listings", gapDetected: true }
    : { price: sellHistory, source: "history", gapDetected: false };
};

/** Builds the "ready" (successfully fetched) state of a row's analysis. */
export const buildReadyAnalysis = (
  buyDataCenter: string,
  buy: ConsistentPrice | undefined,
  /** The recent sale average, or nothing without any sale history. */
  sellHistory: number | undefined,
  /** The cheapest listings' average, or nothing without any listings. */
  sellListings: number | undefined,
  stackSize: number,
  sellPriceCeiling: number | undefined,
  saleVelocityPerDay: number,
  rates: {
    buyTaxRate: number;
    sellTaxRate: number;
    gapThresholdMultiplier: number;
  },
  sellListingStatus: SellListingStatus,
): RowAnalysis => {
  const {
    price: marketPrice,
    source: sellPriceSource,
    gapDetected,
  } = chooseSellPrice(sellHistory, sellListings, rates.gapThresholdMultiplier);

  const sellPriceCapped =
    marketPrice !== undefined &&
    sellPriceCeiling !== undefined &&
    marketPrice > sellPriceCeiling;
  const sellPricePerUnit =
    marketPrice === undefined
      ? undefined
      : sellPriceCapped
        ? sellPriceCeiling!
        : marketPrice;

  const effectiveBuyPricePerUnit = buy
    ? buy.pricePerUnit * (1 + rates.buyTaxRate)
    : undefined;
  const effectiveSellPricePerUnit =
    sellPricePerUnit !== undefined
      ? sellPricePerUnit * (1 - rates.sellTaxRate)
      : undefined;

  const profitPerItem =
    effectiveBuyPricePerUnit !== undefined &&
    effectiveSellPricePerUnit !== undefined
      ? effectiveSellPricePerUnit - effectiveBuyPricePerUnit
      : undefined;

  return {
    status: "ready",
    buyDataCenter,
    buy,
    sellPricePerUnit,
    sellPriceSource,
    sellPriceCapped,
    gapDetected,
    saleVelocityPerDay,
    sellListingStatus,
    effectiveBuyPricePerUnit,
    effectiveSellPricePerUnit,
    profitPerItem,
    profitPerStack:
      profitPerItem !== undefined
        ? profitPerItem * calculateMarketBoardStackSize(stackSize)
        : undefined,
    expectedProfitPerDay:
      profitPerItem !== undefined
        ? profitPerItem * saleVelocityPerDay
        : undefined,
  };
};
