import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { BuyingRegionSection } from "../components/BuyingRegionSection";
import { HintedField } from "../components/Hint";
import { NumberInput } from "../components/NumberInput";
import { pricingHints } from "../components/pricingHints";
import { TrackedItemChangeErrorMessage } from "../components/TrackedItemChangeErrorMessage";
import { useItemProfitScan } from "../hooks/useItemProfitScan";
import {
  trackedItemService,
  type TrackedItemChangeError,
} from "../services/trackedItemService";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, ItemDetails } from "../types";
import { afterSuccess } from "../utils/afterSuccess";

interface ItemPageProps {
  config: TradingConfig;
  currentCharacter: Character | null;
  /** Called after the item is tracked, so the tracked items can be read again. */
  onTrackedItemsChanged: () => void;
}

export const ItemProfitScanContainer = (props: ItemPageProps) => {
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
  onTrackedItemsChanged,
}: ItemPageProps & { itemId: number }) => {
  const {
    itemDetails,
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

  const [trackError, setTrackError] = useState<TrackedItemChangeError | null>(
    null,
  );
  const isTracked = config.trackedItems.some(
    (tracked) => tracked.itemId === itemId && Boolean(tracked.hq) === hq,
  );
  // Tracked as it's currently being priced.
  const track = async (details: ItemDetails) => {
    const result = await afterSuccess(
      trackedItemService.trackItem({
        itemId,
        ...details,
        hq,
        targetQuantity,
        sellPriceCeiling,
      }),
      onTrackedItemsChanged,
    );
    setTrackError(result.ok ? null : result.error);
  };

  return (
    <div className="app">
      <title>{itemDetails?.name ?? `Item #${itemId}`}</title>
      <header>
        <h1>{itemDetails?.name ?? `Item #${itemId}`}</h1>
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
        <HintedField
          className="character-select"
          label="Target qty"
          hint={pricingHints.targetQuantity}
        >
          {(id) => (
            <NumberInput
              id={id}
              min={1}
              value={targetQuantity}
              onChange={(value) => setTargetQuantity(value ?? 1)}
            />
          )}
        </HintedField>
        <HintedField
          className="character-select"
          label="Sell ceiling"
          hint={pricingHints.sellPriceCeiling}
        >
          {(id) => (
            <NumberInput
              id={id}
              min={0}
              placeholder="none"
              value={sellPriceCeiling}
              onChange={setSellPriceCeiling}
            />
          )}
        </HintedField>
        {isTracked ? (
          <span className="last-updated">Tracked as {hq ? "HQ" : "NQ"}</span>
        ) : (
          // Tracking saves the item's name and stack size, so it waits until they're known.
          itemDetails && (
            <button type="button" onClick={() => track(itemDetails)}>
              Track this item
            </button>
          )
        )}
      </div>
      {trackError && <TrackedItemChangeErrorMessage error={trackError} />}

      {buyingRegions.map((buyingRegion) => (
        <BuyingRegionSection
          key={buyingRegion.region}
          buyingRegion={buyingRegion}
          rows={rowsByRegion[buyingRegion.region] ?? []}
          staleWarningThresholdMs={0}
          sellWorld={sellWorld}
          gapThresholdMultiplier={config.params.gapThresholdMultiplier}
        />
      ))}
    </div>
  );
};
