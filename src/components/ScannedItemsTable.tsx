import { memo } from "react";
import { Link } from "react-router-dom";
import { buildMarketPageUrl } from "../api/universalis";
import type { ScannedItem } from "../hooks/useHighVolumeItemScan";
import type { ScannedItemProfit } from "../hooks/useScannedItemProfits";
import type { BuyingRegion } from "../services/tradingConfig";
import { BuyingRegionSection } from "./BuyingRegionSection";

const formatNumber = (value: number): string => {
  return Math.round(value).toLocaleString();
};

/**
 * An item's total units sold per day. Once the item's been priced, hovering
 * over it shows the item's profit through each buying region, laid out like
 * the tracked items page.
 */
const TotalSaleVelocity = ({
  item,
  profit,
  buyingRegions,
  world,
}: {
  item: ScannedItem;
  profit: ScannedItemProfit | undefined;
  buyingRegions: BuyingRegion[];
  world: string;
}) => {
  const total = formatNumber(item.totalSaleVelocity);
  switch (profit?.status) {
    case undefined:
      return total;
    case "loading":
      return <span className="row-refreshing">{total}</span>;
    case "ready":
      return (
        <span className="profit-tooltip-anchor">
          {total}
          <span className="profit-tooltip">
            <span className="profit-tooltip-content">
              {buyingRegions.map((buyingRegion) => {
                const row = profit.rowByRegion[buyingRegion.region];
                if (!row) return null;
                return (
                  <BuyingRegionSection
                    key={buyingRegion.region}
                    buyingRegion={buyingRegion}
                    rows={[{ row, isRefreshing: false }]}
                    // Priced once rather than kept refreshing, so a failed region is flagged straight away, as on the item page.
                    staleWarningThresholdMs={0}
                    sellWorld={world}
                  />
                );
              })}
            </span>
          </span>
        </span>
      );
  }
};

/** Whether buying the item through any region is expected to make more than the given profit per day. */
const exceedsProfitPerDay = (
  profit: ScannedItemProfit | undefined,
  profitPerDay: number,
): boolean =>
  profit?.status === "ready" &&
  Object.values(profit.rowByRegion).some(
    ({ analysis }) =>
      analysis.status === "ready" &&
      analysis.expectedProfitPerDay !== null &&
      analysis.expectedProfitPerDay > profitPerDay,
  );

/**
 * Memoized so that the scan's progress count — which updates every single
 * batch, far more often than this list itself changes — doesn't force this
 * potentially 200-row table to re-render along with it.
 */
export const ScannedItemsTable = memo(
  ({
    items,
    itemNames,
    profits,
    buyingRegions,
    highlightProfitPerDay,
    world,
  }: {
    items: ScannedItem[];
    itemNames: Record<number, string>;
    profits: Record<number, ScannedItemProfit>;
    buyingRegions: BuyingRegion[];
    /** Items expected to make more than this per day through any buying region are highlighted. Omit to highlight nothing. */
    highlightProfitPerDay: number | undefined;
    world: string;
  }) => {
    return (
      <table className="item-table">
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
            <tr
              key={item.itemId}
              className={
                highlightProfitPerDay !== undefined &&
                exceedsProfitPerDay(profits[item.itemId], highlightProfitPerDay)
                  ? "row-highlight"
                  : undefined
              }
            >
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
              <td>
                <TotalSaleVelocity
                  item={item}
                  profit={profits[item.itemId]}
                  buyingRegions={buyingRegions}
                  world={world}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
);
