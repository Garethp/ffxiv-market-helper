import { Link } from "react-router-dom";
import type { PricedItem, TrackedItem } from "../../types";
import { formatAmount } from "../../utils/amount";
import { ErrorMessage } from "../ErrorMessage";
import { ItemSummaryTooltip } from "../ItemSummaryTooltip";

const describeQuality = (item: PricedItem) => (item.hq ? "HQ" : "NQ");

/**
 * One tracked item, with what it's tracked as and the controls for changing it
 * or no longer tracking it. Shows what it's told to: editing happens on a page
 * of its own, and what went wrong with the last change is the caller's to decide.
 */
export const TrackedItemRow = ({
  item,
  editHref,
  errorMessage,
  onUntrack,
}: {
  item: TrackedItem;
  /** Where the page for changing this item's settings lives. */
  editHref: string;
  /** Why the last change to this item wasn't made, if it wasn't. */
  errorMessage?: string;
  onUntrack: () => void;
}) => {
  const description = `${item.name} (${describeQuality(item)})`;

  return (
    <li className="entry-row">
      <span>
        <ItemSummaryTooltip itemId={item.itemId} name={item.name} />{" "}
        <span className="quality-badge">{describeQuality(item)}</span>
      </span>
      <span className="muted">
        Target quantity {formatAmount(item.targetQuantity)}
      </span>
      <span className="muted">
        {item.sellPriceCeiling === undefined
          ? "No sell price ceiling"
          : `Sell price ceiling ${formatAmount(item.sellPriceCeiling)}`}
      </span>
      <Link to={editHref} aria-label={`Edit ${description}`}>
        Edit
      </Link>
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
