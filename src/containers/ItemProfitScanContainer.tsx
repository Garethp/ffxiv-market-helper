import { Navigate, useParams } from "react-router-dom";
import { BuyingRegionSection } from "../components/BuyingRegionSection";
import { NumberInput } from "../components/NumberInput";
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
          <NumberInput
            min={1}
            value={targetQuantity}
            onChange={(value) => setTargetQuantity(value ?? 1)}
          />
        </label>
        <label className="character-select">
          Sell ceiling
          <NumberInput
            min={0}
            placeholder="none"
            value={sellPriceCeiling}
            onChange={setSellPriceCeiling}
          />
        </label>
      </div>

      {buyingRegions.map((buyingRegion) => (
        <BuyingRegionSection
          key={buyingRegion.region}
          buyingRegion={buyingRegion}
          rows={rowsByRegion[buyingRegion.region] ?? []}
          staleWarningThresholdMs={0}
          sellWorld={sellWorld}
        />
      ))}
    </div>
  );
};
