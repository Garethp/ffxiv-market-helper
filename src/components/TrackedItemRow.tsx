import type { TrackedItemSettings } from "../services/trackedItemService";
import type { PricedItem, TrackedItem } from "../types";
import { formatAmount } from "../utils/amount";
import { ErrorMessage } from "./ErrorMessage";
import { ItemSummaryTooltip } from "./ItemSummaryTooltip";
import { TrackedItemSettingsForm } from "./TrackedItemSettingsForm";

const qualityOf = (item: PricedItem) => (item.hq ? "HQ" : "NQ");

/**
 * One tracked item, with the controls for changing its settings or no longer
 * tracking it. Shows what it's told to: whether its settings are being edited,
 * and what went wrong with the last change, are the caller's to decide.
 */
export const TrackedItemRow = ({
  item,
  isEditing,
  errorMessage,
  onEdit,
  onCancelEdit,
  onUpdate,
  onUntrack,
}: {
  item: TrackedItem;
  isEditing: boolean;
  /** Why the last change to this item wasn't made, if it wasn't. */
  errorMessage?: string | null;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (settings: TrackedItemSettings) => void;
  onUntrack: () => void;
}) => {
  const description = `${item.name} (${qualityOf(item)})`;

  if (isEditing) {
    return (
      <li>
        <TrackedItemSettingsForm
          label={`Edit ${description}`}
          initial={{ ...item, quality: qualityOf(item) }}
          submitLabel="Save"
          errorMessage={errorMessage}
          onSubmit={onUpdate}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }

  return (
    <li className="entry-row">
      <span>
        <ItemSummaryTooltip itemId={item.itemId} name={item.name} />{" "}
        <span className="quality-badge">{qualityOf(item)}</span>
      </span>
      <span className="muted">
        Target quantity {formatAmount(item.targetQuantity)}
      </span>
      <span className="muted">
        {item.sellPriceCeiling === undefined
          ? "No sell price ceiling"
          : `Sell price ceiling ${formatAmount(item.sellPriceCeiling)}`}
      </span>
      <button type="button" aria-label={`Edit ${description}`} onClick={onEdit}>
        Edit
      </button>
      <button
        type="button"
        aria-label={`Stop tracking ${description}`}
        onClick={onUntrack}
      >
        Stop tracking
      </button>
      {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
    </li>
  );
};
