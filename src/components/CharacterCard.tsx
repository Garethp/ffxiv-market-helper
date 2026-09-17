import { useState } from "react";
import type {
  CharacterDetails,
  RetainerDetails,
  RosterChangeResult,
} from "../services/characterService";
import type { Character, RegionInfo, Retainer } from "../types";
import { afterSuccess } from "../utils/afterSuccess";
import { findRegionNameForWorld } from "../utils/worldDirectory";
import { CharacterForm } from "./CharacterForm";
import { RetainerForm } from "./RetainerForm";

const RetainerRow = ({
  retainer,
  marketBoardCities,
  onUpdate,
  onRemove,
}: {
  retainer: Retainer;
  marketBoardCities: string[];
  onUpdate: (details: RetainerDetails) => Promise<RosterChangeResult>;
  onRemove: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <li>
        <RetainerForm
          marketBoardCities={marketBoardCities}
          initialDetails={retainer}
          submitLabel="Save retainer"
          // Closed once the change is made, or left open to show why it wasn't.
          onSubmit={(details) =>
            afterSuccess(onUpdate(details), () => setIsEditing(false))
          }
          onCancel={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="entry-row">
      <span>
        {retainer.name} <span className="muted">in {retainer.city}</span>
      </span>
      <button
        type="button"
        aria-label={`Edit ${retainer.name}`}
        onClick={() => setIsEditing(true)}
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Remove ${retainer.name}`}
        onClick={onRemove}
      >
        Remove
      </button>
    </li>
  );
};

/** One character in the roster, with its retainers, and the controls for changing either. */
export const CharacterCard = ({
  character,
  regions,
  marketBoardCities,
  onUpdate,
  onRemove,
  onAddRetainer,
  onUpdateRetainer,
  onRemoveRetainer,
}: {
  character: Character;
  regions: RegionInfo[];
  marketBoardCities: string[];
  onUpdate: (details: CharacterDetails) => Promise<RosterChangeResult>;
  onRemove: () => void;
  onAddRetainer: (details: RetainerDetails) => Promise<RosterChangeResult>;
  onUpdateRetainer: (
    retainerId: string,
    details: RetainerDetails,
  ) => Promise<RosterChangeResult>;
  onRemoveRetainer: (retainerId: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const region =
    findRegionNameForWorld(character.homeWorld, regions) ?? "Unknown region";

  const confirmRemove = () => {
    if (window.confirm(`Remove ${character.name} and their retainers?`)) {
      onRemove();
    }
  };

  return (
    <section className="card" aria-label={character.name}>
      {isEditing ? (
        <CharacterForm
          regions={regions}
          initialDetails={character}
          submitLabel="Save character"
          // Closed once the change is made, or left open to show why it wasn't.
          onSubmit={(details) =>
            afterSuccess(onUpdate(details), () => setIsEditing(false))
          }
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <div className="character-card-header">
            <h2>
              {character.name}{" "}
              <span className="muted">
                {character.homeWorld} ({region})
              </span>
            </h2>
            <button
              type="button"
              aria-label={`Edit ${character.name}`}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              aria-label={`Remove ${character.name}`}
              onClick={confirmRemove}
            >
              Remove
            </button>
          </div>
          {character.note && <p className="character-note">{character.note}</p>}
        </>
      )}

      <h3>Retainers</h3>
      {character.retainers.length === 0 ? (
        <p className="muted">No retainers yet.</p>
      ) : (
        <ul className="entry-list">
          {character.retainers.map((retainer) => (
            <RetainerRow
              key={retainer.id}
              retainer={retainer}
              marketBoardCities={marketBoardCities}
              onUpdate={(details) => onUpdateRetainer(retainer.id, details)}
              onRemove={() => onRemoveRetainer(retainer.id)}
            />
          ))}
        </ul>
      )}
      <RetainerForm
        marketBoardCities={marketBoardCities}
        submitLabel="Add retainer"
        onSubmit={onAddRetainer}
      />
    </section>
  );
};
