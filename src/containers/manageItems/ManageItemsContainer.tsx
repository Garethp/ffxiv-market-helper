import { useState } from "react";
import { Link } from "react-router-dom";
import { TrackedItemExpandableRow } from "../../components/manageItems/TrackedItemExpandableRow";
import { TrackedItemRow } from "../../components/manageItems/TrackedItemRow";
import { ExpandableList } from "../../components/tables/ExpandableList";
import { useIsNarrowScreen } from "../../hooks/useIsNarrowScreen";
import { trackedItemService } from "../../services/trackedItemService";
import type { TradingConfig } from "../../services/tradingConfig";
import type { TrackedItem } from "../../types";

/**
 * Where the tracked items are listed, with the way to each item's own settings
 * page and the way to stop tracking one. Decides what to say when a change
 * couldn't be made, so the rows only have to show it.
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
  const isNarrowScreen = useIsNarrowScreen();
  // Changes are made one at a time, so only the item last changed can have an
  // error of its own to show.
  const [failed, setFailed] = useState<{
    itemId: string;
    message: string;
  } | null>(null);

  const untrack = (item: TrackedItem) => {
    setFailed(null);
    trackedItemService
      .untrackItem(item.id)
      .then(onTrackedItemsChanged)
      .catch(() =>
        setFailed({
          itemId: item.id,
          message: "Something went wrong. Try again shortly.",
        }),
      );
  };

  // Both rows show the same things about an item, so they're given the same things.
  const rowProps = (item: TrackedItem) => ({
    item,
    editHref: `/manage-items/edit/${item.id}`,
    errorMessage: failed?.itemId === item.id ? failed.message : null,
    onUntrack: () => untrack(item),
  });

  return (
    <div className="app">
      <title>Manage Items</title>
      <header>
        <h1>Manage Items</h1>
      </header>

      <Link to="/manage-items/track" className="page-action">
        Track a new item
      </Link>

      {/* The rows draw their own box on a phone, so they aren't put in a card as well. */}
      <section className={isNarrowScreen ? "page-section" : "card"}>
        <h2>Tracked items</h2>
        {trackedItems.length === 0 ? (
          <p className="muted">No items are tracked yet.</p>
        ) : isNarrowScreen ? (
          /* On a phone each item shows only what it's tracked as, opening up into
             what the item is and the ways to change it. */
          <ExpandableList label="Tracked items">
            {trackedItems.map((item) => (
              <TrackedItemExpandableRow key={item.id} {...rowProps(item)} />
            ))}
          </ExpandableList>
        ) : (
          <ul className="entry-list" aria-label="Tracked items">
            {trackedItems.map((item) => (
              <TrackedItemRow key={item.id} {...rowProps(item)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
