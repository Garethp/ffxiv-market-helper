import { useEffect, useMemo, useRef, useState } from "react";
import { BULK_SALE_VELOCITY_BATCH_SIZE } from "../api/universalis";
import { fetchItemNames } from "../api/xivapi";
import { ScannedItemsTable } from "../components/ScannedItemsTable";
import { useHighVolumeItemScan } from "../hooks/useHighVolumeItemScan";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character } from "../types";
import { withOneRetry } from "../utils/withOneRetry";

/** How many of the highest-velocity results to display — scanning can surface thousands of traded items. */
const DISPLAY_LIMIT = 200;

/** How many items checked has to advance before the next name lookup — infrequent enough not to hammer XIVAPI over an ~17,000-item scan. */
const NAME_LOOKUP_INTERVAL = 200;

export const HighVolumeItemsContainer = ({
  config,
  currentCharacter,
}: {
  config: TradingConfig;
  currentCharacter: Character | null;
}) => {
  const { params } = config;
  const world = currentCharacter?.homeWorld ?? "";
  const { status, results, startScan } = useHighVolumeItemScan(world);

  const topItems = useMemo(
    () =>
      [...results]
        .filter((item) => item.totalSaleVelocity > 0)
        .sort((a, b) => b.totalSaleVelocity - a.totalSaleVelocity)
        .slice(0, DISPLAY_LIMIT),
    [results],
  );

  const [itemNames, setItemNames] = useState<Record<number, string>>({});
  // How many items had been checked at the last name lookup, so each 200-item interval only
  // fires once rather than on every batch that happens to land past the boundary.
  const lastNameCheckAtRef = useRef(0);

  // Looks up names for the current top results whenever the scanned-item count has advanced by
  // NAME_LOOKUP_INTERVAL since the last check, plus once more unconditionally when the scan
  // finishes — otherwise a final stretch too short to cross the interval would leave its items
  // unnamed for good. A previous scan's results are all there at once, so they're looked up
  // straight away.
  useEffect(() => {
    if (status.state === "idle" || status.state === "error") return;
    const scannedItems = status.state === "previous" ? 0 : status.scannedItems;

    // A new scan starts its own count back at zero — pick the interval math back up from there too.
    if (scannedItems < lastNameCheckAtRef.current) {
      lastNameCheckAtRef.current = 0;
    }
    const isFinalCheck = status.state !== "running";
    if (
      !isFinalCheck &&
      scannedItems - lastNameCheckAtRef.current < NAME_LOOKUP_INTERVAL
    )
      return;
    lastNameCheckAtRef.current = scannedItems;

    const unnamedItemIds = topItems
      .filter((item) => !(item.itemId in itemNames))
      .map((item) => item.itemId);
    if (unnamedItemIds.length === 0) return;

    withOneRetry(() => fetchItemNames(unnamedItemIds))
      .then((names) => {
        if (names.size === 0) return;
        setItemNames((prev) => ({ ...prev, ...Object.fromEntries(names) }));
      })
      .catch(() => {
        // Names are a nice-to-have — leave items showing by ID rather than failing the page.
      });
  }, [status, topItems, itemNames]);

  const canStart = world !== "" && status.state !== "running";

  return (
    <div className="app">
      <title>High Volume Items</title>
      <header>
        <h1>High Volume Items</h1>
        <p className="subtitle">Sale velocity on {world || "…"}</p>
      </header>

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
      </div>

      <ScannedItemsTable items={topItems} itemNames={itemNames} world={world} />

      <footer>
        <p>
          Scans every item Universalis has ever seen traded, in batches of up to{" "}
          {BULK_SALE_VELOCITY_BATCH_SIZE}, and ranks them by recent sale
          velocity on the selected character's home world. Names for the current
          top results are looked up periodically as the scan runs, not just at
          the end. Click an item's name for a quick profit scan (opens in a new
          tab, so the scan here keeps going), or ↗ to view it on Universalis
          directly. Showing the top {DISPLAY_LIMIT} by total units sold per day.
        </p>
      </footer>
    </div>
  );
};
