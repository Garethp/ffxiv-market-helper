import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ItemSearchResult } from "../../types";
import { ItemSearch } from "../../components/ItemSearch";
import { TrackedItemSettingsForm } from "../../components/TrackedItemSettingsForm";
import {
  trackedItemService,
  type TrackedItemSettings,
} from "../../services/trackedItemService";
import { validateItem } from "../../utils/validation/trackedItems";
import type { TradingConfig } from "../../services/tradingConfig";
import { defaultTargetQuantity } from "../../utils/marketBoardStack";

/**
 * Where a new item is found and tracked, on a page of its own so it has the
 * whole screen to itself. Decides whether the item can be tracked as asked and
 * what to say when it can't, so the form only has to show it.
 */
export const TrackNewItemContainer = ({
  config,
  onTrackedItemsChanged,
}: {
  config: TradingConfig;
  /** Called once an item is tracked, so the tracked items can be read again. */
  onTrackedItemsChanged: () => void;
}) => {
  const { trackedItems } = config;
  const navigate = useNavigate();
  const [picked, setPicked] = useState<ItemSearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const track = (item: ItemSearchResult, settings: TrackedItemSettings) => {
    const tracking = { ...item, ...settings };
    const error = validateItem(tracking, trackedItems);

    // Nothing is attempted while the tracked items wouldn't accept it.
    if (error) return setErrorMessage(error);

    setErrorMessage(null);
    trackedItemService
      .trackItem(tracking)
      .then(() => {
        onTrackedItemsChanged();
        // Back to the list, where the newly tracked item shows.
        navigate("/manage-items");
      })
      .catch(() => setErrorMessage("Something went wrong. Try again shortly."));
  };

  return (
    <div className="app">
      <title>Track a New Item</title>
      <header>
        <h1>Track a New Item</h1>
      </header>

      <section className="card" aria-label="Track a new item">
        <ItemSearch
          onPick={(item: ItemSearchResult) => {
            setPicked(item);
            setErrorMessage(null);
          }}
        />
        {picked && (
          <TrackedItemSettingsForm
            // A different item starts its form over.
            key={picked.itemId}
            label={`Track ${picked.name}`}
            initial={{
              quality: null,
              targetQuantity: defaultTargetQuantity(picked.stackSize),
            }}
            submitLabel="Track item"
            errorMessage={errorMessage}
            onSubmit={(settings) => track(picked, settings)}
            onCancel={() => setPicked(null)}
          />
        )}
      </section>

      <Link to="/manage-items" className="page-action">
        Back to tracked items
      </Link>
    </div>
  );
};
