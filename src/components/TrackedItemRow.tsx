import { useState } from "react";
import type {
  TrackedItemChangeResult,
  TrackedItemSettings,
} from "../services/trackedItemService";
import type { PricedItem, TrackedItem } from "../types";
import { afterSuccess } from "../utils/afterSuccess";
import { formatAmount } from "../utils/amount";
import { TrackedItemSettingsForm } from "./TrackedItemSettingsForm";

const qualityOf = (item: PricedItem) => (item.hq ? "HQ" : "NQ");

/** One tracked item, with the controls for changing its settings or no longer tracking it. */
export const TrackedItemRow = ({
  item,
  onUpdate,
  onUntrack,
}: {
  item: TrackedItem;
  onUpdate: (settings: TrackedItemSettings) => Promise<TrackedItemChangeResult>;
  onUntrack: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const description = `${item.name} (${qualityOf(item)})`;

  if (isEditing) {
    return (
      <li>
        <TrackedItemSettingsForm
          label={`Edit ${description}`}
          initial={{ ...item, quality: qualityOf(item) }}
          submitLabel="Save"
          onSubmit={(settings) =>
            afterSuccess(onUpdate(settings), () => setIsEditing(false))
          }
          onCancel={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="entry-row">
      <span>
        {item.name} <span className="quality-badge">{qualityOf(item)}</span>
      </span>
      <span className="muted">
        Target quantity {formatAmount(item.targetQuantity)}
      </span>
      <span className="muted">
        {item.sellPriceCeiling === undefined
          ? "No sell price ceiling"
          : `Sell price ceiling ${formatAmount(item.sellPriceCeiling)}`}
      </span>
      <button
        type="button"
        aria-label={`Edit ${description}`}
        onClick={() => setIsEditing(true)}
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Stop tracking ${description}`}
        onClick={onUntrack}
      >
        Stop tracking
      </button>
    </li>
  );
};
