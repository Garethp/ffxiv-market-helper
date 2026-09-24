import { Link } from "react-router-dom";
import type { PricedItem, TrackedItem } from "../../types";
import { formatAmount } from "../../utils/amount";
import { ErrorMessage } from "../ErrorMessage";
import { ItemSummary } from "../ItemSummary";
import { ExpandableRow } from "../tables/ExpandableList";

const describeQuality = (item: PricedItem) => (item.hq ? "HQ" : "NQ");

/**
 * One tracked item on a phone: its name and what it's tracked as, opening up into
 * what the item is and the ways to change it. There's no room to hover for a
 * summary here, so the icon, type and description are in the opened row instead.
 *
 * Takes the same props as the wide screen's row, so the page can hand either the
 * same thing.
 */
export const TrackedItemExpandableRow = ({
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
  // Shown collapsed, and kept in view once the row is opened.
  const figures = (
    <dl className="tracked-item-figures">
      <div>
        <dt>Target quantity</dt>
        <dd>{formatAmount(item.targetQuantity)}</dd>
      </div>
      <div>
        <dt>Sell price ceiling</dt>
        <dd>
          {item.sellPriceCeiling === undefined
            ? "none"
            : formatAmount(item.sellPriceCeiling)}
        </dd>
      </div>
    </dl>
  );

  return (
    <ExpandableRow
      heading={
        <span>
          {item.name}{" "}
          <span className="quality-badge">{describeQuality(item)}</span>
        </span>
      }
      expandLabel={`Show what ${description} is`}
      summary={figures}
      details={
        <div className="tracked-item-details">
          {figures}
          {/* Only looked up once the row is opened, since this is only rendered then. */}
          <ItemSummary itemId={item.itemId} />
          <div className="tracked-item-actions">
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
          </div>
        </div>
      }
    >
      {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
    </ExpandableRow>
  );
};
