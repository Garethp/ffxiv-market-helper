import { useState } from "react";
import { Link } from "react-router-dom";
import { TrackedItemRow } from "../../components/TrackedItemRow";
import {
  trackedItemService,
  type TrackedItemSettings,
} from "../../services/trackedItemService";
import { validateItem } from "../../utils/validation/trackedItems";
import type { TradingConfig } from "../../services/tradingConfig";
import type { TrackedItem } from "../../types";

/**
 * Where the tracked items are listed: changing their settings and no longer
 * tracking them. Decides whether a change can be made and what to say when it
 * can't, so the rows and their forms only have to show it.
 */
export const ManageItemsContainer = ({
  config,
  onTrackedItemsChanged,
}: {
  config: TradingConfig;
  /** Called after every change made to the tracked items, so they can be read again. */
  onTrackedItemsChanged: () => void;
}) => {
  const { trackedItems } = config;
  // Only one item's settings are edited at a time, and only that item can have
  // a change of its own that didn't go through.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refused, setRefused] = useState<{
    itemId: string;
    message: string;
  } | null>(null);

  const startEditing = (item: TrackedItem) => {
    setEditingId(item.id);
    setRefused(null);
  };

  const stopEditing = () => {
    setEditingId(null);
    setRefused(null);
  };

  const refuse = (item: TrackedItem, message: string) =>
    setRefused({ itemId: item.id, message });

  const update = (item: TrackedItem, settings: TrackedItemSettings) => {
    const refusal = validateItem({ ...item, ...settings }, trackedItems, {
      excludingId: item.id,
    });
    // Nothing is attempted while the tracked items wouldn't accept it.
    if (refusal) return refuse(item, refusal);

    setRefused(null);
    trackedItemService
      .updateTrackedItem(item.id, settings)
      .then(() => {
        setEditingId(null);
        onTrackedItemsChanged();
      })
      .catch(() => refuse(item, "Something went wrong. Try again shortly."));
  };

  const untrack = (item: TrackedItem) => {
    setRefused(null);
    trackedItemService
      .untrackItem(item.id)
      .then(onTrackedItemsChanged)
      .catch(() => refuse(item, "Something went wrong. Try again shortly."));
  };

  return (
    <div className="app">
      <title>Manage Items</title>
      <header>
        <h1>Manage Items</h1>
      </header>

      <Link to="/manage-items/track" className="page-action">
        Track a new item
      </Link>

      <section className="card">
        <h2>Tracked items</h2>
        {trackedItems.length === 0 ? (
          <p className="muted">No items are tracked yet.</p>
        ) : (
          <ul className="entry-list" aria-label="Tracked items">
            {trackedItems.map((item) => (
              <TrackedItemRow
                key={item.id}
                item={item}
                isEditing={item.id === editingId}
                errorMessage={
                  refused?.itemId === item.id ? refused.message : null
                }
                onEdit={() => startEditing(item)}
                onCancelEdit={stopEditing}
                onUpdate={(settings) => update(item, settings)}
                onUntrack={() => untrack(item)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
