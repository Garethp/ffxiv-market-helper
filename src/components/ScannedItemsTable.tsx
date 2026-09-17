import { memo } from "react";
import { Link } from "react-router-dom";
import { buildMarketPageUrl } from "../api/universalis";
import type { ScannedItem } from "../hooks/useHighVolumeItemScan";

const formatNumber = (value: number): string => {
  return Math.round(value).toLocaleString();
};

/**
 * Memoized so that the scan's progress count — which updates every single
 * batch, far more often than this list itself changes — doesn't force this
 * potentially 200-row table to re-render along with it.
 */
export const ScannedItemsTable = memo(
  ({
    items,
    itemNames,
    world,
  }: {
    items: ScannedItem[];
    itemNames: Record<number, string>;
    world: string;
  }) => {
    return (
      <table className="flip-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>NQ / day</th>
            <th>HQ / day</th>
            <th>Total / day</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.itemId}>
              <td>
                <Link
                  to={`/item/${item.itemId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Quick profit scan (opens in a new tab, so this scan keeps running)"
                >
                  {itemNames[item.itemId] ?? `#${item.itemId}`}
                </Link>{" "}
                <a
                  href={buildMarketPageUrl(item.itemId, world)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on Universalis"
                  className="external-link"
                >
                  ↗
                </a>
              </td>
              <td>{formatNumber(item.nqSaleVelocity)}</td>
              <td>{formatNumber(item.hqSaleVelocity)}</td>
              <td>{formatNumber(item.totalSaleVelocity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
);
