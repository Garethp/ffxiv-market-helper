import { BuyingRegionSection } from "../components/BuyingRegionSection";
import { useTrackedItemsAnalysis } from "../hooks/useTrackedItemsAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character } from "../types";

export const TrackedItemsContainer = ({
  config,
  currentCharacter,
}: {
  config: TradingConfig;
  currentCharacter: Character | null;
}) => {
  const { rowsByRegion, lastUpdated } = useTrackedItemsAnalysis(
    config,
    currentCharacter,
  );
  const { buyingRegions, params } = config;
  const sellWorld = currentCharacter?.homeWorld ?? "";

  return (
    <div className="app">
      <title>Tracked Items</title>
      <header>
        <h1>Tracked Items</h1>
        <p className="subtitle">Selling on {sellWorld || "…"}</p>
      </header>

      <div className="toolbar">
        {lastUpdated && (
          <span className="last-updated">
            Last updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <span className="last-updated">
          Rows refresh automatically every {params.refreshIntervalMs / 1000}s
        </span>
      </div>

      {buyingRegions.map((buyingRegion) => (
        <BuyingRegionSection
          key={buyingRegion.region}
          buyingRegion={buyingRegion}
          rows={rowsByRegion[buyingRegion.region] ?? []}
          staleWarningThresholdMs={params.staleWarningThresholdMs}
          sellWorld={sellWorld}
        />
      ))}

      <footer>
        <p>
          Buy price = weighted-average cost to fill each item's target quantity
          from the cheapest available listings, + buy tax. Sell price = average
          of recent sales, − sell tax, unless current listings sit well above
          recent sales (a "gap"), in which case it's the average of the cheapest
          current listings instead — capped at that item's configured sell price
          ceiling, if it has one. Expected profit / day = profit per item × how
          many actually sold in the last day, so a high profit-per-stack item
          that barely trades won't look better than it is. A ⚠ means fetches
          have been failing and the shown data may be stale.
        </p>
      </footer>
    </div>
  );
};
