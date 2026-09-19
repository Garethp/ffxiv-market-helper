import { useQueries, type QueryObserverResult } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  REGION_LISTINGS_BATCH_SIZE,
  fetchRegionListings,
  type RegionListing,
} from "../api/universalis";
import type { ExpertDeliveryPrice } from "../services/expertDelivery";
import { chunk } from "../utils/chunk";

/**
 * Prices each item by every listing of it anywhere in the region, in
 * batches, keyed by item ID. Every batch is asked for at once, and the
 * request limiter lets them through in order, so items are priced in the
 * order given. An item whose batch hasn't come back yet has no price.
 */
export const useExpertDeliveryPrices = (
  itemIds: number[],
  region: string,
): Record<number, ExpertDeliveryPrice> => {
  const batches = useMemo(
    () => chunk(itemIds, REGION_LISTINGS_BATCH_SIZE),
    [itemIds],
  );

  const combine = useCallback(
    (queries: QueryObserverResult<Map<number, RegionListing[]>>[]) => {
      const prices: Record<number, ExpertDeliveryPrice> = {};
      batches.forEach((batch, b) => {
        const { data: listings, isError } = queries[b];
        batch.forEach((itemId) => {
          if (isError) {
            prices[itemId] = { status: "failed" };
            return;
          }
          if (listings === undefined) return;
          const itemListings = listings.get(itemId);
          prices[itemId] = itemListings
            ? { status: "listed", listings: itemListings }
            : { status: "unlisted" };
        });
      });
      return prices;
    },
    [batches],
  );

  return useQueries({
    queries: batches.map((batch) => ({
      queryKey: ["regionListings", region, batch],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchRegionListings(region, batch, { signal }),
      // Priced once, rather than kept refreshing while the page is open.
      staleTime: Infinity,
    })),
    combine,
  });
};
