import type { ItemDataStatus } from "../services/itemDataCache";

/**
 * A bar along the bottom of every page while the item data is being loaded,
 * or if loading it failed. Shows nothing otherwise.
 */
export const ItemDataStatusBar = ({ status }: { status: ItemDataStatus }) => {
  switch (status.state) {
    case "idle":
    case "checking":
    case "ready":
      return null;
    case "waiting":
      return (
        <div className="item-data-status" role="status">
          <div className="item-data-status-bar" />
          <p>Waiting for another tab to finish loading item data…</p>
        </div>
      );
    case "loading":
      return (
        <div className="item-data-status" role="status">
          <div className="item-data-status-bar" />
          <p>
            Loading item data: {status.itemsSoFar.toLocaleString()} items so
            far. This only happens once per game update, and makes item names
            quick to look up from then on.
          </p>
        </div>
      );
    case "failed":
      return (
        <div className="item-data-status item-data-status-failed" role="status">
          <p>
            Couldn't load item data ({status.message}). Item names will be
            looked up as they're needed instead.
          </p>
        </div>
      );
  }
};
