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
          gapThresholdMultiplier={params.gapThresholdMultiplier}
        />
      ))}
    </div>
  );
};
