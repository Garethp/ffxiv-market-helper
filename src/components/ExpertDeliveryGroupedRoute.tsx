import {
  calculateExpectedSealsPerGil,
  calculateMaximumPriceWithinFilters,
  type BuyingFilters,
  type GroupedRouteLeg,
  type GroupedRouteStop,
} from "../services/expertDelivery";
import { formatGil, formatNumber } from "../utils/format";
import { HintedColumnHeader } from "./tables/HintedColumnHeader";
import { ItemNameWithCopy } from "./ItemNameWithCopy";
import { ItemSummaryTooltip } from "./ItemSummaryTooltip";

const countListingsAt = ({ itemsToBuy }: GroupedRouteStop): number =>
  itemsToBuy.reduce((total, { listings }) => total + listings.length, 0);

const countSealsAt = ({ itemsToBuy }: GroupedRouteStop): number =>
  itemsToBuy.reduce(
    (total, { item, listings }) => total + item.seals * listings.length,
    0,
  );

const describeFilters = ({
  minimumSealsPerGil,
  maximumPricePerUnit,
}: BuyingFilters): string => {
  const limits = [
    minimumSealsPerGil !== undefined &&
      `at least ${minimumSealsPerGil} seals per gil`,
    maximumPricePerUnit !== undefined &&
      `at most ${formatGil(maximumPricePerUnit)} gil`,
  ].filter(Boolean);
  return limits.length === 0 ? "no limits" : limits.join(" and ");
};

const StopTable = ({
  stop,
  filters,
  copiedKey,
  onCopy,
}: {
  stop: GroupedRouteStop;
  filters: BuyingFilters;
  copiedKey?: string;
  onCopy: (key: string, text: string) => void;
}) => (
  <table className="item-table fixed-columns">
    <colgroup>
      <col style={{ width: "45%" }} />
      <col style={{ width: "12%" }} />
      <col style={{ width: "15%" }} />
      <col style={{ width: "15%" }} />
      <col style={{ width: "13%" }} />
    </colgroup>
    <thead>
      <tr>
        <th>Item</th>
        <th>Listings</th>
        <HintedColumnHeader
          name="Max price"
          hint={`The most one can cost and still meet the filters (${describeFilters(filters)}). A listing that wasn't there when prices were fetched is worth buying at up to this.`}
        />
        <HintedColumnHeader
          name="Expected seals / gil"
          hint="The seals per gil of buying every listing counted here. Some may have sold since prices were fetched."
        />
        <th>Seals / item</th>
      </tr>
    </thead>
    <tbody>
      {stop.itemsToBuy.map((itemToBuy) => {
        const { item, listings } = itemToBuy;
        const key = `${stop.world}-${item.itemId}`;
        const maximumPrice = calculateMaximumPriceWithinFilters(item, filters);
        return (
          <tr key={key}>
            <td>
              <ItemNameWithCopy
                name={
                  <ItemSummaryTooltip itemId={item.itemId} name={item.name} />
                }
                isCopied={copiedKey === key}
                onCopy={() => onCopy(key, item.name)}
              />
            </td>
            <td>{formatNumber(listings.length)}</td>
            <td>
              {maximumPrice === undefined ? "Any" : formatGil(maximumPrice)}
            </td>
            <td>{calculateExpectedSealsPerGil(itemToBuy).toFixed(2)}</td>
            <td>{formatNumber(item.seals)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

/** The items to buy, a row per item on each world, in the order to visit the worlds. */
export const ExpertDeliveryGroupedRoute = ({
  legs,
  homeWorld,
  filters,
  copiedKey,
  onCopy,
}: {
  legs: GroupedRouteLeg[];
  homeWorld: string;
  /** The filters the listings were picked by, which set the most worth paying. */
  filters: BuyingFilters;
  /** The row whose item name was just copied, if any. */
  copiedKey?: string;
  onCopy: (key: string, text: string) => void;
}) => (
  <>
    {legs.map((leg) => (
      <section
        key={leg.dataCenter ?? ""}
        className="route-leg"
        aria-label={leg.dataCenter ?? "Unknown data center"}
      >
        <h2>{leg.dataCenter ?? "Unknown data center"}</h2>
        {leg.stops.map((stop) => {
          const listingCount = countListingsAt(stop);
          return (
            <section
              key={stop.world}
              className="route-stop"
              aria-label={stop.world}
            >
              <h3>
                {stop.world}
                {stop.world === homeWorld && " (home world)"}{" "}
                <span className="muted">
                  {listingCount} listing{listingCount === 1 ? "" : "s"},{" "}
                  {formatNumber(countSealsAt(stop))} seals
                </span>
              </h3>
              <StopTable
                stop={stop}
                filters={filters}
                copiedKey={copiedKey}
                onCopy={onCopy}
              />
            </section>
          );
        })}
      </section>
    ))}
  </>
);
