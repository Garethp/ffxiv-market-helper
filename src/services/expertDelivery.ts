import type { RegionListing } from "../api/universalis";
import type { ExpertDeliveryCandidate, RegionInfo } from "../types";
import { findDataCenterForWorld } from "../utils/worldDirectory";

/** An item on the market board that can be handed in for an Expert Delivery, with the seals it's worth. */
export type ExpertDeliveryItem = ExpertDeliveryCandidate & { seals: number };

/**
 * The candidates that hand in for at least the given number of seals, fewest
 * seals first. A candidate whose item level has no seal value is left out,
 * since what it's worth can't be known.
 */
export const selectExpertDeliveryItems = (
  candidates: ExpertDeliveryCandidate[],
  sealsByItemLevel: Map<number, number>,
  minimumSeals: number,
): ExpertDeliveryItem[] =>
  candidates
    .flatMap((candidate) => {
      const seals = sealsByItemLevel.get(candidate.itemLevel);
      return seals !== undefined && seals >= minimumSeals
        ? [{ ...candidate, seals }]
        : [];
    })
    .sort(compareBySealsThenName);

const compareBySealsThenName = (a: ExpertDeliveryItem, b: ExpertDeliveryItem) =>
  a.seals - b.seals || a.name.localeCompare(b.name);

/** What pricing an item found. An item that hasn't been priced yet has none. */
export type ExpertDeliveryPrice =
  | {
      status: "listed";
      /** Every listing of the item in the region; there's always at least one. */
      listings: RegionListing[];
    }
  | { status: "unlisted" }
  | { status: "failed" };

/** How many seals each gil spent on the listing buys. */
export const calculateSealsPerGil = (
  item: ExpertDeliveryItem,
  listing: RegionListing,
): number => item.seals / listing.pricePerUnit;

/** Limits on which listings are worth buying. A limit that isn't set lets anything through. */
export interface BuyingFilters {
  minimumSealsPerGil?: number;
  maximumPricePerUnit?: number;
}

const meetsFilters = (
  item: ExpertDeliveryItem,
  listing: RegionListing,
  { minimumSealsPerGil, maximumPricePerUnit }: BuyingFilters,
): boolean =>
  (minimumSealsPerGil === undefined ||
    calculateSealsPerGil(item, listing) >= minimumSealsPerGil) &&
  (maximumPricePerUnit === undefined ||
    listing.pricePerUnit <= maximumPricePerUnit);

/** An item worth buying, and its listings that are worth buying from. */
export interface ItemToBuy {
  item: ExpertDeliveryItem;
  /** Most seals per gil first; there's always at least one. */
  listings: RegionListing[];
}

/** The listing of an item worth the most seals per gil. */
export const findBestListing = ({ listings }: ItemToBuy): RegionListing =>
  listings[0];

/** The seals per gil of an item's listings, on average. */
export const calculateAverageSealsPerGil = ({
  item,
  listings,
}: ItemToBuy): number =>
  listings.reduce(
    (total, listing) => total + calculateSealsPerGil(item, listing),
    0,
  ) / listings.length;

/**
 * The items with listings inside the filters, and those listings, in the
 * order worth buying them: most seals per gil from their best listing first.
 * Items that aren't priced yet, have no listings, or couldn't be priced are
 * left out, along with those with no listings inside the filters.
 */
export const selectItemsToBuy = (
  items: ExpertDeliveryItem[],
  prices: Record<number, ExpertDeliveryPrice>,
  filters: BuyingFilters,
): ItemToBuy[] =>
  items
    .flatMap((item) => {
      const price = prices[item.itemId];
      if (price?.status !== "listed") return [];
      const listings = price.listings
        .filter((listing) => meetsFilters(item, listing, filters))
        // For one item, the cheaper the listing, the more seals per gil.
        .sort((a, b) => a.pricePerUnit - b.pricePerUnit);
      return listings.length > 0 ? [{ item, listings }] : [];
    })
    .sort(
      (a, b) =>
        calculateSealsPerGil(b.item, findBestListing(b)) -
          calculateSealsPerGil(a.item, findBestListing(a)) ||
        compareBySealsThenName(a.item, b.item),
    );

/** A listing to buy on a world along the route, and the item it's of. */
export interface RouteListing {
  item: ExpertDeliveryItem;
  listing: RegionListing;
}

/** A world to visit, and what to buy there. */
export interface RouteStop {
  world: string;
  /** Most seals per gil first. */
  listings: RouteListing[];
}

/** The worlds to visit in one data center, in the order to visit them. */
export interface RouteLeg {
  /** Missing for worlds that aren't in the directory. */
  dataCenter?: string;
  stops: RouteStop[];
}

/** How many seals buying everything at a stop would bring in. */
export const countSealsAt = (stop: RouteStop): number =>
  stop.listings.reduce((total, { item }) => total + item.seals, 0);

const countSealsAcross = (stops: RouteStop[]): number =>
  stops.reduce((total, stop) => total + countSealsAt(stop), 0);

const compareByMostSealsThenWorld = (a: RouteStop, b: RouteStop) =>
  countSealsAt(b) - countSealsAt(a) || a.world.localeCompare(b.world);

const compareByMostSealsPerGil = (a: RouteListing, b: RouteListing) =>
  calculateSealsPerGil(b.item, b.listing) -
    calculateSealsPerGil(a.item, a.listing) ||
  compareBySealsThenName(a.item, b.item);

/**
 * Splits every listing worth buying up by the world it's on, in the order to
 * go and buy them: the home world first, then the rest of its data center,
 * then each other data center, since changing data center takes longer than
 * changing world. Worlds within a data center, and the other data centers, are
 * visited most seals on offer first. Worlds that aren't in the directory come
 * last. An item listed on several worlds, or several times on one, is bought
 * at each.
 */
export const planRoute = (
  itemsToBuy: ItemToBuy[],
  homeWorld: string,
  regions: RegionInfo[],
): RouteLeg[] => {
  const listingsByWorld = new Map<string, RouteListing[]>();
  itemsToBuy.forEach(({ item, listings }) =>
    listings.forEach((listing) => {
      const { worldName } = listing;
      listingsByWorld.set(worldName, [
        ...(listingsByWorld.get(worldName) ?? []),
        { item, listing },
      ]);
    }),
  );

  const stopsByDataCenter = new Map<string | undefined, RouteStop[]>();
  listingsByWorld.forEach((worldListings, world) => {
    const dataCenter = findDataCenterForWorld(world, regions);
    stopsByDataCenter.set(dataCenter, [
      ...(stopsByDataCenter.get(dataCenter) ?? []),
      { world, listings: worldListings.sort(compareByMostSealsPerGil) },
    ]);
  });

  const homeDataCenter = findDataCenterForWorld(homeWorld, regions);
  const compareHomeFirst = (a: RouteStop, b: RouteStop) =>
    Number(b.world === homeWorld) - Number(a.world === homeWorld) ||
    compareByMostSealsThenWorld(a, b);
  const legs: RouteLeg[] = Array.from(
    stopsByDataCenter,
    ([dataCenter, stops]) => ({
      dataCenter,
      stops: stops.sort(compareHomeFirst),
    }),
  );
  // Home data center first and unknown worlds last, with the rest most seals first.
  const rankLeg = ({ dataCenter }: RouteLeg) =>
    dataCenter === undefined ? 2 : dataCenter === homeDataCenter ? 0 : 1;
  return legs.sort(
    (a, b) =>
      rankLeg(a) - rankLeg(b) ||
      countSealsAcross(b.stops) - countSealsAcross(a.stops) ||
      (a.dataCenter ?? "").localeCompare(b.dataCenter ?? ""),
  );
};
