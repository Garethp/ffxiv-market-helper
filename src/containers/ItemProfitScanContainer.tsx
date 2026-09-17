import { Link, Navigate, useParams } from "react-router-dom";
import { ProfitTable } from "../components/ProfitTable";
import { useItemProfitScan } from "../hooks/useItemProfitScan";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character } from "../types";

interface SharedStateProps {
  config: TradingConfig;
  currentCharacter: Character | null;
}

export const ItemProfitScanContainer = (props: SharedStateProps) => {
  const { itemId: itemIdParam } = useParams<{ itemId: string }>();
  return /^\d+$/.test(itemIdParam ?? "") ? (
    <ItemProfitScan itemId={Number(itemIdParam)} {...props} />
  ) : (
    <Navigate to="/" replace />
  );
};

const ItemProfitScan = ({
  itemId,
  config,
  currentCharacter,
}: SharedStateProps & { itemId: number }) => {
  const {
    itemName,
    hq,
    setHq,
    targetQuantity,
    setTargetQuantity,
    sellPriceCeiling,
    setSellPriceCeiling,
    rowsByRegion,
  } = useItemProfitScan(itemId, config, currentCharacter);
  const { buyingRegions } = config;
  const sellWorld = currentCharacter?.homeWorld ?? "";

  return (
    <div className="app">
      <title>{itemName ?? `Item #${itemId}`}</title>
      <header>
        <h1>{itemName ?? `Item #${itemId}`}</h1>
        <p className="subtitle">
          <Link to="/high-volume-items" className="nav-link">
            ← High volume items
          </Link>{" "}
          · <Link to="/">Tracked items</Link>
        </p>
      </header>

      <div className="toolbar">
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
      </div>

      {buyingRegions.map((buyingRegion) => (
        <section key={buyingRegion.region} className="character-section">
          <h2>
            Buying via {buyingRegion.characters.map((c) => c.name).join(", ")} (
            {buyingRegion.region})
          </h2>
          <ProfitTable
            rows={rowsByRegion[buyingRegion.region] ?? []}
            staleWarningThresholdMs={0}
            sellWorld={sellWorld}
          />
        </section>
      ))}
    </div>
  );
};
