import { Link, Navigate, useParams } from "react-router-dom";
import { FlipTable } from "../components/FlipTable";
import { useItemProfitScan } from "../hooks/useItemProfitScan";

export const ItemProfitScanContainer = () => {
  const { itemId: itemIdParam } = useParams<{ itemId: string }>();
  return /^\d+$/.test(itemIdParam ?? "") ? (
    <ItemProfitScan itemId={Number(itemIdParam)} />
  ) : (
    <Navigate to="/" replace />
  );
};

const ItemProfitScan = ({ itemId }: { itemId: number }) => {
  const {
    itemName,
    allCharacterNames,
    currentCharacterName,
    setCurrentCharacterName,
    hq,
    setHq,
    targetQuantity,
    setTargetQuantity,
    sellPriceCeiling,
    setSellPriceCeiling,
    buyingRegions,
    rowsByRegion,
    sellWorld,
    isScanning,
    hasScanned,
    runScan,
  } = useItemProfitScan(itemId);

  return (
    <div className="app">
      <title>{itemName ?? `Item #${itemId}`}</title>
      <header>
        <h1>{itemName ?? `Item #${itemId}`}</h1>
        <p className="subtitle">
          <Link to="/high-volume-items" className="nav-link">
            ← High volume items
          </Link>{" "}
          · <Link to="/">Flip table</Link>
        </p>
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
        <label className="character-select">
          <input
            type="checkbox"
            checked={hq}
            onChange={(e) => setHq(e.target.checked)}
          />
          HQ
        </label>
        <label className="character-select">
          Target qty
          <input
            type="number"
            min={1}
            value={targetQuantity}
            onChange={(e) =>
              setTargetQuantity(Math.max(1, Number(e.target.value) || 1))
            }
          />
        </label>
        <label className="character-select">
          Sell ceiling
          <input
            type="number"
            min={0}
            placeholder="none"
            value={sellPriceCeiling ?? ""}
            onChange={(e) =>
              setSellPriceCeiling(
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
          />
        </label>
        <button
          type="button"
          onClick={runScan}
          disabled={isScanning || !currentCharacterName}
        >
          {isScanning ? "Scanning…" : hasScanned ? "Rescan" : "Scan"}
        </button>
      </div>

      {!hasScanned && (
        <p className="subtitle">
          Loading — this prices the item across every buying region, the same
          way a tracked item would be priced, without adding it to the tracked
          list. Adjust the inputs above and rescan to try different numbers.
        </p>
      )}

      {buyingRegions.map((buyingRegion) => (
        <section key={buyingRegion.region} className="character-section">
          <h2>
            Buying via {buyingRegion.characters.map((c) => c.name).join(", ")} (
            {buyingRegion.region})
          </h2>
          <FlipTable
            rows={rowsByRegion[buyingRegion.region] ?? []}
            staleWarningThresholdMs={0}
            sellWorld={sellWorld}
          />
        </section>
      ))}
    </div>
  );
};
