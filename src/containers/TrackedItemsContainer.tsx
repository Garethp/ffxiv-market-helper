import { BuyingRegionSection } from "../components/BuyingRegionSection";
import { ProfitExpandableRows } from "../components/ProfitExpandableRows";
import { ProfitTable } from "../components/ProfitTable";
import { useIsNarrowScreen } from "../hooks/useIsNarrowScreen";
import { useTrackedItemsAnalysis } from "../hooks/useTrackedItemsAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character } from "../types";

export const TrackedItemsContainer = ({
  config,
  currentCharacter,
}: {
  config: TradingConfig;
  currentCharacter: Character;
}) => {
  const { rowsByRegion, lastUpdated } = useTrackedItemsAnalysis(
    config,
    currentCharacter,
  );
  const isNarrowScreen = useIsNarrowScreen();

  const { buyingRegions, params } = config;
  const sellWorld = currentCharacter.homeWorld;

  return (
    <div className="app">
      <title>Tracked Items</title>
      <header>
        <h1>Tracked Items</h1>
        <p className="subtitle">Selling on {sellWorld}</p>
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
        >
          {/* On a phone, each row shows only its profit until it's expanded. */}
          {isNarrowScreen ? (
            <ProfitExpandableRows
              rows={rowsByRegion[buyingRegion.region] ?? []}
              sellWorld={sellWorld}
            />
          ) : (
            <ProfitTable
              rows={rowsByRegion[buyingRegion.region] ?? []}
              sellWorld={sellWorld}
              gapThresholdMultiplier={params.gapThresholdMultiplier}
            />
          )}
        </BuyingRegionSection>
      ))}
    </div>
  );
};
