import type { CheapestListing } from "../api/universalis";
import {
  fetchExpertDeliveryCandidates,
  fetchExpertDeliverySealsByItemLevel,
  type ExpertDeliveryCandidate,
} from "../api/xivapi";

/** An item on the market board that can be handed in for an Expert Delivery, with the seals it's worth. */
export type ExpertDeliveryItem = ExpertDeliveryCandidate & { seals: number };

/**
 * Items on the market board that hand in for at least the given number of
 * seals, fewest seals first. An item whose item level has no seal value is
 * left out, since what it's worth can't be known.
 */
export const listExpertDeliveryItems = async (
  minimumSeals: number,
): Promise<ExpertDeliveryItem[]> => {
  const [candidates, sealsByItemLevel] = await Promise.all([
    fetchExpertDeliveryCandidates(),
    fetchExpertDeliverySealsByItemLevel(),
  ]);
  return candidates
    .flatMap((candidate) => {
      const seals = sealsByItemLevel.get(candidate.itemLevel);
      return seals !== undefined && seals >= minimumSeals
        ? [{ ...candidate, seals }]
        : [];
    })
    .sort(bySealsThenName);
};

const bySealsThenName = (a: ExpertDeliveryItem, b: ExpertDeliveryItem) =>
  a.seals - b.seals || a.name.localeCompare(b.name);

/** What pricing an item found. An item that hasn't been priced yet has none. */
export type ExpertDeliveryPrice =
  | { status: "listed"; listing: CheapestListing }
  | { status: "unlisted" }
  | { status: "failed" };

/** How many seals each gil spent on the listing buys. */
export const sealsPerGil = (
  item: ExpertDeliveryItem,
  listing: CheapestListing,
): number => item.seals / listing.pricePerUnit;

/**
 * The items in the order worth buying them: those that are listed first, most
 * seals per gil first. Then those not priced yet, then those with no listings
 * or whose price couldn't be fetched, each fewest seals first.
 */
export const sortForBuying = (
  items: ExpertDeliveryItem[],
  prices: Record<number, ExpertDeliveryPrice>,
): ExpertDeliveryItem[] => {
  const listed: { item: ExpertDeliveryItem; sealsPerGil: number }[] = [];
  const unpriced: ExpertDeliveryItem[] = [];
  const unbuyable: ExpertDeliveryItem[] = [];
  items.forEach((item) => {
    const price = prices[item.itemId];
    if (price === undefined) unpriced.push(item);
    else if (price.status === "listed")
      listed.push({ item, sealsPerGil: sealsPerGil(item, price.listing) });
    else unbuyable.push(item);
  });
  return [
    ...listed
      .sort(
        (a, b) =>
          b.sealsPerGil - a.sealsPerGil || bySealsThenName(a.item, b.item),
      )
      .map(({ item }) => item),
    ...unpriced.sort(bySealsThenName),
    ...unbuyable.sort(bySealsThenName),
  ];
};
