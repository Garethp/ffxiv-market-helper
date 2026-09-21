import { useState } from "react";
import type { ItemSearchResult } from "../types";
import { ItemSearch } from "../components/ItemSearch";
import { TrackedItemRow } from "../components/TrackedItemRow";
import { TrackedItemSettingsForm } from "../components/TrackedItemSettingsForm";
import {
  trackedItemService,
  type TrackedItemChangeResult,
} from "../services/trackedItemService";
import type { TradingConfig } from "../services/tradingConfig";
import { afterSuccess } from "../utils/afterSuccess";
import { defaultTargetQuantity } from "../utils/marketBoardStack";

/** Where the tracked items are set up: tracking new items, changing their settings, and no longer tracking them. */
export const ManageItemsContainer = ({
  config,
  onTrackedItemsChanged,
}: {
  config: TradingConfig;
  /** Called after every change made to the tracked items, so they can be read again. */
  onTrackedItemsChanged: () => void;
}) => {
  const { trackedItems } = config;
  const [picked, setPicked] = useState<ItemSearchResult | null>(null);

  const reportingChanges = (change: Promise<TrackedItemChangeResult>) =>
    afterSuccess(change, onTrackedItemsChanged);

  return (
    <div className="app">
      <title>Manage Items</title>
      <header>
        <h1>Manage Items</h1>
      </header>

      <section className="card">
        <h2>Track an item</h2>
        <ItemSearch onPick={setPicked} />
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
            onSubmit={(settings) =>
              afterSuccess(
                reportingChanges(
                  trackedItemService.trackItem({ ...picked, ...settings }),
                ),
                () => setPicked(null),
              )
            }
            onCancel={() => setPicked(null)}
          />
        )}
      </section>

      <section className="card">
        <h2>Tracked items</h2>
        {trackedItems.length === 0 ? (
          <p className="muted">
            No items are tracked yet. Search above to track one.
          </p>
        ) : (
          <ul className="entry-list" aria-label="Tracked items">
            {trackedItems.map((item) => (
              <TrackedItemRow
                key={item.id}
                item={item}
                onUpdate={(settings) =>
                  reportingChanges(
                    trackedItemService.updateTrackedItem(item.id, settings),
                  )
                }
                onUntrack={() =>
                  reportingChanges(trackedItemService.untrackItem(item.id))
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
