import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExpertDeliveryFilters } from "../components/ExpertDeliveryFilters";
import { ExpertDeliveryGroupedRoute } from "../components/ExpertDeliveryGroupedRoute";
import { ExpertDeliveryRoute } from "../components/ExpertDeliveryRoute";
import { useCopyText } from "../hooks/useCopyText";
import { useExpertDeliveryPrices } from "../hooks/useExpertDeliveryPrices";
import {
  groupRouteByItem,
  planRoute,
  selectItemsToBuy,
  type ExpertDeliveryItem,
} from "../services/expertDelivery";
import { itemService } from "../services/itemService";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character } from "../types";
import { findRegionNameForWorld } from "../utils/worldDirectory";
import { formatNumber } from "../utils/format";

/** Items worth fewer seals than this are left off the list. */
const MINIMUM_SEALS = 150;

/** The seals per gil a listing has to be worth to be shown — until changed on the page. */
const DEFAULT_MINIMUM_SEALS_PER_GIL = 4;

/** The most a listing can cost to be shown — until changed on the page. */
const DEFAULT_MAXIMUM_PRICE_PER_UNIT = 1000;

/** How the route is laid out: a row per listing, or a row per item on each world. */
type View = "route" | "groupedRoute";

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
  // Changed only once typing in a filter pauses, so the items aren't laid out again for every key.
  const filters = useMemo(
    () => ({ minimumSealsPerGil, maximumPricePerUnit }),
    [minimumSealsPerGil, maximumPricePerUnit],
  );
  const itemsToBuy = useMemo(
    () => selectItemsToBuy(items ?? NO_ITEMS, prices, filters),
    [items, prices, filters],
  );

  const [view, setView] = useState<View>("route");
  const route = useMemo(
    () => planRoute(itemsToBuy, currentCharacter.homeWorld, config.regions),
    [itemsToBuy, currentCharacter.homeWorld, config.regions],
  );
  const groupedRoute = useMemo(() => groupRouteByItem(route), [route]);

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
          The route shows the worlds to visit and the listings to buy on each,
          to reduce world hopping and data-center hopping.
        </p>
        <p>
          The grouped route visits the same worlds, with a row per item on each
          world rather than a row per listing, so an item can be bought in one
          go. It shows the most a listing can cost and still meet the filters,
          for listings that weren't there when prices were fetched.
        </p>
      </div>

      <div className="toolbar">
        <div className="view-toggle" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={view === "route"}
            onClick={() => setView("route")}
          >
            Route
          </button>
          <button
            type="button"
            aria-pressed={view === "groupedRoute"}
            onClick={() => setView("groupedRoute")}
          >
            Route (Grouped)
          </button>
        </div>
        <ExpertDeliveryFilters
          minimumSealsPerGil={minimumSealsPerGil}
          onMinimumSealsPerGilChange={setMinimumSealsPerGil}
          maximumPricePerUnit={maximumPricePerUnit}
          onMaximumPricePerUnitChange={setMaximumPricePerUnit}
        />
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
              Couldn't fetch prices for {formatNumber(failedCount)} item
              {failedCount === 1 ? "" : "s"}.
            </p>
          )}
          {itemsToBuy.length === 0 ? (
            <p className="muted">No listings meet the filters.</p>
          ) : view === "route" ? (
            <ExpertDeliveryRoute
              legs={route}
              homeWorld={currentCharacter.homeWorld}
              copiedKey={copiedKey}
              onCopy={copyText}
            />
          ) : (
            <ExpertDeliveryGroupedRoute
              legs={groupedRoute}
              homeWorld={currentCharacter.homeWorld}
              filters={filters}
              copiedKey={copiedKey}
              onCopy={copyText}
            />
          )}
        </>
      )}
    </div>
  );
};
