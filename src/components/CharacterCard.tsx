import { useState } from "react";
import type {
  CharacterDetails,
  RetainerDetails,
} from "../services/characterService";
import {
  validateCharacter,
  validateRetainer,
  type ReferenceData,
  type RosterValidationError,
} from "../utils/validation/roster";
import type { Character, RegionInfo, Retainer } from "../types";
import { findRegionNameForWorld } from "../utils/worldDirectory";
import { ErrorMessage } from "./ErrorMessage";
import { CharacterForm } from "./CharacterForm";
import { RetainerForm } from "./RetainerForm";

const RetainerRow = ({
  retainer,
  marketBoardCities,
  validate,
  onUpdate,
  onRemove,
}: {
  retainer: Retainer;
  marketBoardCities: string[];
  validate: (details: RetainerDetails) => RosterValidationError | undefined;
  onUpdate: (details: RetainerDetails) => Promise<void>;
  onRemove: () => Promise<void>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  if (isEditing) {
    return (
      <li>
        <RetainerForm
          marketBoardCities={marketBoardCities}
          initialDetails={retainer}
          submitLabel="Save retainer"
          validate={validate}
          // Closed once the change is made, or left open to show why it wasn't.
          onSubmit={(details) =>
            onUpdate(details).then(() => setIsEditing(false))
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
        onClick={() => onRemove().catch(() => setHasFailed(true))}
      >
        Remove
      </button>
      {hasFailed && (
        <ErrorMessage>Something went wrong. Try again shortly.</ErrorMessage>
      )}
    </li>
  );
};

/** One character in the roster, with its retainers, and the controls for changing either. */
export const CharacterCard = ({
  character,
  roster,
  regions,
  marketBoardCities,
  onUpdate,
  onRemove,
  onAddRetainer,
  onUpdateRetainer,
  onRemoveRetainer,
}: {
  character: Character;
  /** The whole roster, so a change can be checked for a name another character already has. */
  roster: Character[];
  regions: RegionInfo[];
  marketBoardCities: string[];
  onUpdate: (details: CharacterDetails) => Promise<void>;
  onRemove: () => Promise<void>;
  onAddRetainer: (details: RetainerDetails) => Promise<void>;
  onUpdateRetainer: (
    retainerId: string,
    details: RetainerDetails,
  ) => Promise<void>;
  onRemoveRetainer: (retainerId: string) => Promise<void>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const region =
    findRegionNameForWorld(character.homeWorld, regions) ?? "Unknown region";
  const reference: ReferenceData = { regions, marketBoardCities };

  const confirmRemove = () => {
    if (window.confirm(`Remove ${character.name} and their retainers?`)) {
      onRemove().catch(() => setHasFailed(true));
    }
  };

  return (
    <section className="card" aria-label={character.name}>
      {isEditing ? (
        <CharacterForm
          regions={regions}
          initialDetails={character}
          submitLabel="Save character"
          validate={(details) =>
            validateCharacter(details, roster, reference, {
              excludingId: character.id,
            })
          }
          // Closed once the change is made, or left open to show why it wasn't.
          onSubmit={(details) =>
            onUpdate(details).then(() => setIsEditing(false))
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
          {hasFailed && (
            <ErrorMessage>
              Something went wrong. Try again shortly.
            </ErrorMessage>
          )}
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
              validate={(details) =>
                validateRetainer(details, character.retainers, reference, {
                  excludingId: retainer.id,
                })
              }
              onUpdate={(details) => onUpdateRetainer(retainer.id, details)}
              onRemove={() => onRemoveRetainer(retainer.id)}
            />
          ))}
        </ul>
      )}
      <RetainerForm
        marketBoardCities={marketBoardCities}
        submitLabel="Add retainer"
        validate={(details) =>
          validateRetainer(details, character.retainers, reference)
        }
        onSubmit={onAddRetainer}
      />
    </section>
  );
};
