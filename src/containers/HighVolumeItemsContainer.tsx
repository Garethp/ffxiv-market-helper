import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BULK_SALE_VELOCITY_BATCH_SIZE } from "../api/universalis";
import { fetchItemNames } from "../api/xivapi";
import { ScannedItemsTable } from "../components/ScannedItemsTable";
import { useHighVolumeItemScan } from "../hooks/useHighVolumeItemScan";
import { configService } from "../services/configService";
import type { RegionInfo } from "../types";
import { withOneRetry } from "../utils/withOneRetry";

/** How many of the highest-velocity results to display — scanning can surface thousands of traded items. */
const DISPLAY_LIMIT = 200;

/** How many items checked has to advance before the next name lookup — infrequent enough not to hammer XIVAPI over an ~17,000-item scan. */
const NAME_LOOKUP_INTERVAL = 200;

export const HighVolumeItemsContainer = () => {
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [world, setWorld] = useState("");
  const [entriesPerItem, setEntriesPerItem] = useState<number | null>(null);
  const [statsWithinMs, setStatsWithinMs] = useState<number | null>(null);
  const { status, results, startScan, isPaused, pause, resume } =
    useHighVolumeItemScan();

  useEffect(() => {
    Promise.all([
      configService.getRegions(),
      configService.getCharacters(),
      configService.getDefaultCharacterName(),
      configService.getTradingParameters(),
    ]).then(([loadedRegions, characters, defaultCharacterName, params]) => {
      setRegions(loadedRegions);
      setEntriesPerItem(params.sellHistoryFetchCount);
      setStatsWithinMs(params.saleVelocityWindowMs);
      const defaultCharacter = characters.find(
        (character) => character.name === defaultCharacterName,
      );
      if (defaultCharacter) setWorld(defaultCharacter.homeWorld);
    });
  }, []);

  const topItems = useMemo(
    () =>
      [...results]
        .filter((item) => item.totalSaleVelocity > 0)
        .sort((a, b) => b.totalSaleVelocity - a.totalSaleVelocity)
        .slice(0, DISPLAY_LIMIT),
    [results],
  );

  const [itemNames, setItemNames] = useState<Record<number, string>>({});
  // How many items had been checked at the last name lookup, so each 400-item interval only
  // fires once rather than on every batch that happens to land past the boundary.
  const lastNameCheckAtRef = useRef(0);

  // Looks up names for the current top results whenever the scanned-item count has advanced by
  // NAME_LOOKUP_INTERVAL since the last check, plus once more unconditionally when the scan
  // finishes — otherwise a final stretch too short to cross the interval would leave its items
  // unnamed for good.
  useEffect(() => {
    const scannedItems =
      status.state === "running" || status.state === "done"
        ? status.scannedItems
        : null;
    if (scannedItems === null) return;

    // A new scan starts its own count back at zero — pick the interval math back up from there too.
    if (scannedItems < lastNameCheckAtRef.current) {
      lastNameCheckAtRef.current = 0;
    }
    const isFinalCheck = status.state === "done";
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

  const canStart =
    world !== "" &&
    entriesPerItem !== null &&
    statsWithinMs !== null &&
    status.state !== "running";

  return (
    <div className="app">
      <title>High Volume Items</title>
      <header>
        <h1>High Volume Items</h1>
        <p className="subtitle">
          <Link to="/" className="nav-link">
            ← Back to flip table
          </Link>
        </p>
      </header>

      <div className="toolbar">
        <label className="character-select">
          World
          <select value={world} onChange={(e) => setWorld(e.target.value)}>
            {regions.map((region) => (
              <optgroup key={region.name} label={region.name}>
                {region.dataCenters.flatMap((dataCenter) =>
                  dataCenter.worlds.map((worldName) => (
                    <option key={worldName} value={worldName}>
                      {worldName} ({dataCenter.name})
                    </option>
                  )),
                )}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!canStart}
          onClick={() => {
            if (entriesPerItem !== null && statsWithinMs !== null) {
              startScan(world, entriesPerItem, statsWithinMs);
            }
          }}
        >
          {status.state === "running" ? "Scanning…" : "Start scan"}
        </button>
        {status.state === "running" && (
          <button type="button" onClick={isPaused ? resume : pause}>
            {isPaused ? "Resume" : "Pause"}
          </button>
        )}
        {status.state === "running" && (
          <span className="last-updated">
            {isPaused ? "Paused — " : ""}
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
        {status.state === "error" && (
          <span className="last-updated">Scan failed: {status.message}</span>
        )}
      </div>

      <ScannedItemsTable items={topItems} itemNames={itemNames} world={world} />

      <footer>
        <p>
          Scans every item Universalis has ever seen traded, in batches of up to{" "}
          {BULK_SALE_VELOCITY_BATCH_SIZE}, and ranks them by recent sale
          velocity on the selected world. Names for the current top results are
          looked up periodically as the scan runs, not just at the end. Click an
          item's name for a quick profit scan (opens in a new tab, so the scan
          here keeps going — pause it first if you'd rather it didn't), or ↗ to
          view it on Universalis directly. Showing the top {DISPLAY_LIMIT} by
          total units sold per day.
        </p>
      </footer>
    </div>
  );
};
