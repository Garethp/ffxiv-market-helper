import {
  sealsAt,
  sealsPerGil,
  type RouteLeg,
  type RouteStop,
} from "../services/expertDelivery";
import { formatGil } from "../utils/format";
import { FixedWidthColumns } from "./FixedWidthColumns";
import { ItemNameWithCopy } from "./ItemNameWithCopy";
import { ItemSummaryTooltip } from "./ItemSummaryTooltip";

const COLUMNS = [
  { name: "Item", width: "55%" },
  { name: "Price", width: "15%" },
  { name: "Seals / gil", width: "15%" },
  { name: "Seals", width: "15%" },
];

const StopTable = ({
  stop,
  copiedKey,
  onCopy,
}: {
  stop: RouteStop;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) => (
  <table className="item-table fixed-columns">
    <FixedWidthColumns columns={COLUMNS} />
    <tbody>
      {stop.listings.map(({ item, listing }, index) => {
        // An item can be listed on several worlds, and more than once on one, even at the same price.
        const key = `${stop.world}-${item.itemId}-${index}`;
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
            <td>{formatGil(listing.pricePerUnit)}</td>
            <td>{sealsPerGil(item, listing).toFixed(2)}</td>
            <td>{item.seals.toLocaleString()}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

/** The listings to buy, a table per world, in the order to visit the worlds. */
export const ExpertDeliveryRoute = ({
  legs,
  homeWorld,
  copiedKey,
  onCopy,
}: {
  legs: RouteLeg[];
  homeWorld: string;
  /** The row whose item name was just copied, if any. */
  copiedKey: string | null;
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
        {leg.stops.map((stop) => (
          <section
            key={stop.world}
            className="route-stop"
            aria-label={stop.world}
          >
            <h3>
              {stop.world}
              {stop.world === homeWorld && " (home world)"}{" "}
              <span className="muted">
                {stop.listings.length} listing
                {stop.listings.length === 1 ? "" : "s"},{" "}
                {sealsAt(stop).toLocaleString()} seals
              </span>
            </h3>
            <StopTable stop={stop} copiedKey={copiedKey} onCopy={onCopy} />
          </section>
        ))}
      </section>
    ))}
  </>
);
