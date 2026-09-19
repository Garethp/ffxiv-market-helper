import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ExpertDeliveryItemsTable } from "../components/ExpertDeliveryItemsTable";
import { useExpertDeliveryPrices } from "../hooks/useExpertDeliveryPrices";
import {
  listExpertDeliveryItems,
  sortForBuying,
  type ExpertDeliveryItem,
} from "../services/expertDelivery";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character } from "../types";
import { findRegionNameForWorld } from "../utils/worldDirectory";

/** Items worth fewer seals than this are left off the list. */
const MINIMUM_SEALS = 150;

const NO_ITEMS: ExpertDeliveryItem[] = [];

export const ExpertDeliveryContainer = ({
  config,
  currentCharacter,
}: {
  config: TradingConfig;
  currentCharacter: Character;
}) => {
  // Game data, which only changes with a patch, so it's read once per visit.
  const { data: items, error } = useQuery({
    queryKey: ["expertDeliveryItems", MINIMUM_SEALS],
    queryFn: () => listExpertDeliveryItems(MINIMUM_SEALS),
    staleTime: Infinity,
  });

  // The Current Character hands the items in, so they're bought from anywhere it can reach.
  const region = findRegionNameForWorld(
    currentCharacter.homeWorld,
    config.regions,
  );

  // Priced in the order they were listed, fewest seals first. Nothing's priced without a region.
  const itemIds = useMemo(
    () =>
      region === undefined
        ? []
        : (items ?? NO_ITEMS).map((item) => item.itemId),
    [items, region],
  );
  const prices = useExpertDeliveryPrices(itemIds, region ?? "");
  const sortedItems = useMemo(
    () => sortForBuying(items ?? NO_ITEMS, prices),
    [items, prices],
  );

  return (
    <div className="app">
      <title>Expert Delivery</title>
      <header>
        <h1>Expert Delivery</h1>
        <p className="subtitle">Buying in {region ?? "…"}</p>
      </header>

      <div className="page-intro">
        <p>
          Items on the market board that can be handed in to a Grand Company for
          an Expert Delivery, worth at least {MINIMUM_SEALS} seals. Each item is
          priced at its cheapest listing anywhere the selected character can
          reach, most seals per gil first. Items not priced yet follow, fewest
          seals first.
        </p>
      </div>

      {region === undefined ? (
        <p className="muted">
          {currentCharacter.homeWorld} isn't a world we know the region of, so
          there's nowhere to price items.
        </p>
      ) : error ? (
        <p className="muted">Couldn't load the items: {error.message}</p>
      ) : items === undefined ? (
        <p className="muted">Loading items…</p>
      ) : (
        <ExpertDeliveryItemsTable
          items={sortedItems}
          prices={prices}
          regions={config.regions}
        />
      )}
    </div>
  );
};
