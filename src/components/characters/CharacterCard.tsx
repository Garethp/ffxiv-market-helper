import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Character, RegionInfo } from "../../types";
import { findRegionNameForWorld } from "../../utils/worldDirectory";

/**
 * One character in the roster, with its retainers and the controls for changing
 * either. Shows what it's told to: adding and editing happen on pages of their
 * own.
 */
export const CharacterCard = ({
  character,
  regions,
  editHref,
  addRetainerHref,
  onRemove,
  children,
}: {
  character: Character;
  regions: RegionInfo[];
  /** Where the page for changing this character's details lives. */
  editHref: string;
  /** Where the page for adding a retainer to this character lives. */
  addRetainerHref: string;
  /** Called once removing the character, and its retainers with it, is confirmed. */
  onRemove: () => void;
  /** A row for each of the character's retainers. */
  children?: ReactNode;
}) => {
  const region =
    findRegionNameForWorld(character.homeWorld, regions) ?? "Unknown region";

  const confirmRemove = () => {
    if (window.confirm(`Remove ${character.name} and their retainers?`)) {
      onRemove();
    }
  };

  return (
    <section className="card" aria-label={character.name}>
      <div className="character-card-header">
        <h2>
          {character.name}{" "}
          <span className="muted">
            {character.homeWorld} ({region})
          </span>
        </h2>
        <Link to={editHref} aria-label={`Edit ${character.name}`}>
          Edit
        </Link>
        <button
          type="button"
          aria-label={`Remove ${character.name}`}
          onClick={confirmRemove}
        >
          Remove
        </button>
      </div>
      {character.note && <p className="character-note">{character.note}</p>}

      <h3>Retainers</h3>
      {character.retainers.length === 0 ? (
        <p className="muted">No retainers yet.</p>
      ) : (
        <ul className="entry-list" aria-label={`${character.name}'s retainers`}>
          {children}
        </ul>
      )}
      <Link
        to={addRetainerHref}
        className="page-action"
        aria-label={`Add a retainer for ${character.name}`}
      >
        Add a retainer
      </Link>
    </section>
  );
};
