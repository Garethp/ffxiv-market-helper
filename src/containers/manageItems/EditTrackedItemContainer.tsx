import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { TrackedItemSettingsForm } from "../../components/manageItems/TrackedItemSettingsForm";
import {
  trackedItemService,
  type TrackedItemSettings,
} from "../../services/trackedItemService";
import type { TradingConfig } from "../../services/tradingConfig";
import { validateItem } from "../../utils/validation/trackedItems";

/**
 * Where one tracked item's settings are changed, on a page of its own so it has
 * the whole screen to itself. Decides whether the settings can be saved and what
 * to say when they can't, so the form only has to show it.
 */
export const EditTrackedItemContainer = ({
  config,
  onTrackedItemsChanged,
}: {
  config: TradingConfig;
  /** Called once the settings are saved, so the tracked items can be read again. */
  onTrackedItemsChanged: () => void;
}) => {
  const { trackedItems } = config;
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Untracked in another tab, or an address typed by hand. Replaced rather than
  // pushed, so going back doesn't land here again.
  const item = trackedItems.find(({ id }) => id === itemId);
  if (!item) return <Navigate to="/manage-items" replace />;

  const onSubmit = (settings: TrackedItemSettings) => {
    const error = validateItem({ ...item, ...settings }, trackedItems, item.id);
    // Nothing is attempted while the tracked items wouldn't accept it.
    if (error) return setErrorMessage(error);

    setErrorMessage(null);
    trackedItemService
      .updateTrackedItem(item.id, settings)
      .then(() => {
        onTrackedItemsChanged();
        // Back to the list, where the changed settings show.
        navigate("/manage-items");
      })
      .catch(() => setErrorMessage("Something went wrong. Try again shortly."));
  };

  const itemQuality = item.hq ? "HQ" : "NQ";

  return (
    <div className="app">
      <title>{`Edit ${item.name} (${itemQuality})`}</title>
      <header>
        <h1>
          Edit {item.name} ({itemQuality})
        </h1>
      </header>

      <section
        className="card"
        aria-label={`Edit ${item.name} (${itemQuality})`}
      >
        <TrackedItemSettingsForm
          label={`Edit ${item.name} (${itemQuality})`}
          initial={{ ...item, quality: itemQuality }}
          submitLabel="Save"
          errorMessage={errorMessage}
          onSubmit={onSubmit}
          onCancel={() => navigate("/manage-items")}
        />
      </section>

      <Link to="/manage-items" className="page-action">
        Back to tracked items
      </Link>
    </div>
  );
};
