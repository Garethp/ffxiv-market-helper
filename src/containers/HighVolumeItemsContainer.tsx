import { useMemo, useState } from "react";
import { NumberInput } from "../components/forms/NumberInput";
import { ScannedItemsTable } from "../components/ScannedItemsTable";
import { useHighVolumeItemScan } from "../hooks/useHighVolumeItemScan";
import { useScannedItemProfits } from "../hooks/useScannedItemProfits";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character } from "../types";

/** How many of the highest-velocity results to display — scanning can surface thousands of traded items. */
const DISPLAY_LIMIT = 200;

/** How many of the top results get their profit priced once there's no scan running. */
const PRICED_ITEM_LIMIT = 50;

/** The expected profit per day an item has to beat, through any buying region, to be highlighted — until changed on the page. */
const DEFAULT_HIGHLIGHT_PROFIT_PER_DAY = 500_000;

export const HighVolumeItemsContainer = ({
  config,
  currentCharacter,
}: {
  config: TradingConfig;
  currentCharacter: Character;
}) => {
  const { params } = config;
  const world = currentCharacter.homeWorld;
  const { status, results, startScan } = useHighVolumeItemScan(world);

  const topItems = useMemo(
    () =>
      [...results]
        .filter((item) => item.totalSaleVelocity > 0)
        .sort((a, b) => b.totalSaleVelocity - a.totalSaleVelocity)
        .slice(0, DISPLAY_LIMIT),
    [results],
  );

  // Only priced once the results have settled — a running scan keeps reshuffling its top items.
  const hasSettledResults =
    status.state === "done" || status.state === "previous";
  const itemsToPrice = hasSettledResults
    ? topItems.slice(0, PRICED_ITEM_LIMIT)
    : [];
  const profits = useScannedItemProfits(itemsToPrice, config, currentCharacter);

  const [highlightProfitPerDay, setHighlightProfitPerDay] = useState<
    number | undefined
  >(DEFAULT_HIGHLIGHT_PROFIT_PER_DAY);

  const canStart = status.state !== "running";

  return (
    <div className="app">
      <title>High Volume Items</title>
      <header>
        <h1>High Volume Items</h1>
        <p className="subtitle">Sale velocity on {world}</p>
      </header>

      <div className="page-intro">
        <p>
          Scans every item Universalis has ever seen traded and ranks them by
          recent sale velocity on the selected character's home world. Hover
          over an item's name to see what it is, or click ↗ to view it on
          Universalis directly. Showing the top {DISPLAY_LIMIT} by total units
          sold per day.
        </p>
        <p>
          Once the scan has completed, the top {PRICED_ITEM_LIMIT} will have
          their expected profits fetched and calculated. For those items, hover
          over their total/day to see the profit table for that item. Items
          expected to make more than the highlight amount per day through any
          buying region are highlighted.
        </p>
      </div>

      <div className="toolbar">
        <button
          type="button"
          disabled={!canStart}
          onClick={() =>
            startScan(params.sellHistoryFetchCount, params.saleVelocityWindowMs)
          }
        >
          {status.state === "running" ? "Scanning…" : "Start scan"}
        </button>
        {status.state === "running" && (
          <span className="last-updated">
            {status.scannedItems.toLocaleString()} /{" "}
            {status.totalItems.toLocaleString()} items checked
          </span>
        )}
        {status.state === "done" && (
          <span className="last-updated">
            Scan complete — {status.scannedItems.toLocaleString()} items checked
            {status.failedBatchCount > 0
              ? `, ${status.failedBatchCount} batch(es) failed and were skipped`
              : ""}
          </span>
        )}
        {status.state === "previous" && (
          <span className="last-updated">
            Showing the last scan, completed{" "}
            {new Date(status.completedAt).toLocaleString()}
          </span>
        )}
        {status.state === "error" && (
          <span className="last-updated">Scan failed: {status.message}</span>
        )}
        <label className="character-select">
          Highlight profit / day over
          <NumberInput
            min={0}
            placeholder="none"
            value={highlightProfitPerDay}
            onChange={setHighlightProfitPerDay}
          />
        </label>
      </div>

      <ScannedItemsTable
        items={topItems}
        profits={profits}
        buyingRegions={config.buyingRegions}
        highlightProfitPerDay={highlightProfitPerDay}
        world={world}
        gapThresholdMultiplier={params.gapThresholdMultiplier}
      />
    </div>
  );
};
