import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExpertDeliveryItemsTable } from "../components/ExpertDeliveryItemsTable";
import { ExpertDeliveryRoute } from "../components/ExpertDeliveryRoute";
import { NumberInput } from "../components/NumberInput";
import { useCopyText } from "../hooks/useCopyText";
import { useExpertDeliveryPrices } from "../hooks/useExpertDeliveryPrices";
import {
  planRoute,
  selectItemsToBuy,
  type ExpertDeliveryItem,
} from "../services/expertDelivery";
import { itemService } from "../services/itemService";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character } from "../types";
import { findRegionNameForWorld } from "../utils/worldDirectory";

/** Items worth fewer seals than this are left off the list. */
const MINIMUM_SEALS = 150;

/** The seals per gil a listing has to be worth to be shown — until changed on the page. */
const DEFAULT_MINIMUM_SEALS_PER_GIL = 4;

/** The most a listing can cost to be shown — until changed on the page. */
const DEFAULT_MAXIMUM_PRICE_PER_UNIT = 1000;

/** How the items are laid out: one list, or split up by the world to buy them on. */
type View = "list" | "route";

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
    queryFn: () => itemService.getExpertDeliveryItems(MINIMUM_SEALS),
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

  const [minimumSealsPerGil, setMinimumSealsPerGil] = useState<
    number | undefined
  >(DEFAULT_MINIMUM_SEALS_PER_GIL);
  const [maximumPricePerUnit, setMaximumPricePerUnit] = useState<
    number | undefined
  >(DEFAULT_MAXIMUM_PRICE_PER_UNIT);
  const itemsToBuy = useMemo(
    () =>
      selectItemsToBuy(items ?? NO_ITEMS, prices, {
        minimumSealsPerGil,
        maximumPricePerUnit,
      }),
    [items, prices, minimumSealsPerGil, maximumPricePerUnit],
  );

  const [view, setView] = useState<View>("list");
  const route = useMemo(
    () => planRoute(itemsToBuy, currentCharacter.homeWorld, config.regions),
    [itemsToBuy, currentCharacter.homeWorld, config.regions],
  );

  // Pricing everything is quick, so nothing's shown until it's done.
  const isPriced = itemIds.every((itemId) => prices[itemId] !== undefined);
  // Items that couldn't be priced aren't in either view, so they're counted instead.
  const failedCount = itemIds.filter(
    (itemId) => prices[itemId]?.status === "failed",
  ).length;

  const { copiedKey, copyText } = useCopyText();

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
          an Expert Delivery, priced by their listings anywhere the selected
          character can reach. You can set the minimum seal/gil ratio for items
          and the maximum sale price.
        </p>
        <p>
          The list shows all items matching the filters, ordered by the best
          seal/gil ratio of each item. The route view shows the route and items
          to buy to reduce world hopping and data-center hopping.
        </p>
      </div>

      <div className="toolbar">
        <div className="view-toggle" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === "route"}
            onClick={() => setView("route")}
          >
            Route
          </button>
        </div>
        <label className="character-select">
          Minimum seals / gil
          <NumberInput
            min={0}
            placeholder="none"
            value={minimumSealsPerGil}
            onChange={setMinimumSealsPerGil}
          />
        </label>
        <label className="character-select">
          Maximum price
          <NumberInput
            min={0}
            placeholder="none"
            value={maximumPricePerUnit}
            onChange={setMaximumPricePerUnit}
          />
        </label>
      </div>

      {region === undefined ? (
        <p className="muted">
          {currentCharacter.homeWorld} isn't a world we know the region of, so
          there's nowhere to price items.
        </p>
      ) : error ? (
        <p className="muted">Couldn't load the items: {error.message}</p>
      ) : items === undefined || !isPriced ? (
        <p className="muted">Loading items…</p>
      ) : (
        <>
          {failedCount > 0 && (
            <p className="muted">
              Couldn't fetch prices for {failedCount.toLocaleString()} item
              {failedCount === 1 ? "" : "s"}.
            </p>
          )}
          {itemsToBuy.length === 0 ? (
            <p className="muted">No listings meet the filters.</p>
          ) : view === "list" ? (
            <ExpertDeliveryItemsTable
              itemsToBuy={itemsToBuy}
              regions={config.regions}
              copiedKey={copiedKey}
              onCopy={copyText}
            />
          ) : (
            <ExpertDeliveryRoute
              legs={route}
              homeWorld={currentCharacter.homeWorld}
              copiedKey={copiedKey}
              onCopy={copyText}
            />
          )}
        </>
      )}
    </div>
  );
};
