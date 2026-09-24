import { Link } from "react-router-dom";
import type { Retainer } from "../../types";

/**
 * One of a character's retainers, with the city it's in and the controls for
 * changing or removing it. Editing happens on a page of its own.
 */
export const RetainerRow = ({
  retainer,
  editHref,
  onRemove,
}: {
  retainer: Retainer;
  /** Where the page for changing this retainer lives. */
  editHref: string;
  onRemove: () => void;
}) => (
  <li className="entry-row">
    <span>
      {retainer.name} <span className="muted">in {retainer.city}</span>
    </span>
    <Link to={editHref} aria-label={`Edit ${retainer.name}`}>
      Edit
    </Link>
    <button
      type="button"
      aria-label={`Remove ${retainer.name}`}
      onClick={onRemove}
    >
      Remove
    </button>
  </li>
);
