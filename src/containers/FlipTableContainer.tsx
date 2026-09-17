import { Link } from "react-router-dom";
import { FlipTable } from "../components/FlipTable";
import { useFlipAnalysis } from "../hooks/useFlipAnalysis";

export const FlipTableContainer = () => {
  const {
    buyingRegions,
    allCharacterNames,
    currentCharacterName,
    setCurrentCharacterName,
    sellWorld,
    rowsByRegion,
    lastUpdated,
    refreshIntervalMs,
    staleWarningThresholdMs,
  } = useFlipAnalysis();

  return (
    <div className="app">
      <title>FFXIV Flipping Helper</title>
      <header>
        <h1>FFXIV Flipping Helper</h1>
        <p className="subtitle">Selling on {sellWorld || "…"}</p>
      </header>

      <div className="toolbar">
        <label className="character-select">
          Selling as
          <select
            value={currentCharacterName ?? ""}
            onChange={(e) => setCurrentCharacterName(e.target.value)}
            disabled={allCharacterNames.length === 0}
          >
            {allCharacterNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {lastUpdated && (
          <span className="last-updated">
            Last updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <span className="last-updated">
          {refreshIntervalMs
            ? `Rows refresh automatically every ${refreshIntervalMs / 1000}s`
            : ""}
        </span>
        <Link to="/high-volume-items" className="nav-link">
          Find high-volume items →
        </Link>
      </div>

      {buyingRegions.map((buyingRegion) => (
        <section key={buyingRegion.region} className="character-section">
          <h2>
            Buying via {buyingRegion.characters.map((c) => c.name).join(", ")} (
            {buyingRegion.region})
          </h2>
          {buyingRegion.characters.map((character) =>
            character.note ? (
              <p key={character.name} className="character-note">
                {character.name}: {character.note}
              </p>
            ) : null,
          )}
          <FlipTable
            rows={rowsByRegion[buyingRegion.region] ?? []}
            staleWarningThresholdMs={staleWarningThresholdMs}
            sellWorld={sellWorld}
          />
        </section>
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
