import { useState } from "react";
import { BuyingRegionSection } from "../components/BuyingRegionSection";
import { ProfitCards } from "../components/ProfitCards";
import { ProfitExpandableRows } from "../components/ProfitExpandableRows";
import { ProfitTable } from "../components/ProfitTable";
import { ProfitTableFewerColumns } from "../components/ProfitTableFewerColumns";
import { useIsNarrowScreen } from "../hooks/useIsNarrowScreen";
import { useTrackedItemsAnalysis } from "../hooks/useTrackedItemsAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, DisplayRow } from "../types";

/** The ways of fitting the rows onto a phone, being tried out side by side. */
type NarrowLayout = "cards" | "fewer-columns" | "expandable";

const narrowLayouts: { layout: NarrowLayout; name: string }[] = [
  { layout: "cards", name: "Cards" },
  { layout: "fewer-columns", name: "Fewer columns" },
  { layout: "expandable", name: "Expandable" },
];

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
  const isNarrowScreen = useIsNarrowScreen();
  const [narrowLayout, setNarrowLayout] = useState<NarrowLayout>("cards");

  const { buyingRegions, params } = config;
  const sellWorld = currentCharacter?.homeWorld ?? "";

  const rowsIn = (rows: DisplayRow[]) => {
    if (!isNarrowScreen) {
      return (
        <ProfitTable
          rows={rows}
          staleWarningThresholdMs={params.staleWarningThresholdMs}
          sellWorld={sellWorld}
          gapThresholdMultiplier={params.gapThresholdMultiplier}
        />
      );
    }
    switch (narrowLayout) {
      case "cards":
        return (
          <ProfitCards
            rows={rows}
            staleWarningThresholdMs={params.staleWarningThresholdMs}
            sellWorld={sellWorld}
          />
        );
      case "fewer-columns":
        return (
          <ProfitTableFewerColumns
            rows={rows}
            staleWarningThresholdMs={params.staleWarningThresholdMs}
            sellWorld={sellWorld}
            gapThresholdMultiplier={params.gapThresholdMultiplier}
          />
        );
      case "expandable":
        return (
          <ProfitExpandableRows
            rows={rows}
            staleWarningThresholdMs={params.staleWarningThresholdMs}
            sellWorld={sellWorld}
          />
        );
    }
  };

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
        {isNarrowScreen && (
          <div className="view-toggle" role="group" aria-label="Phone layout">
            {narrowLayouts.map(({ layout, name }) => (
              <button
                key={layout}
                type="button"
                aria-pressed={narrowLayout === layout}
                onClick={() => setNarrowLayout(layout)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {buyingRegions.map((buyingRegion) => (
        <BuyingRegionSection
          key={buyingRegion.region}
          buyingRegion={buyingRegion}
        >
          {rowsIn(rowsByRegion[buyingRegion.region] ?? [])}
        </BuyingRegionSection>
      ))}
    </div>
  );
};
