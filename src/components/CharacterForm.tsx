import { useState, type FormEvent } from "react";
import type {
  CharacterDetails,
  RosterChangeError,
  RosterChangeResult,
} from "../services/characterService";
import type { RegionInfo } from "../types";
import { RosterChangeErrorMessage } from "./RosterChangeErrorMessage";

const NO_DETAILS: CharacterDetails = { name: "", homeWorld: "" };

/** Enters a character's details, for adding a new character or changing an existing one. */
export const CharacterForm = ({
  regions,
  initialDetails = NO_DETAILS,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  regions: RegionInfo[];
  initialDetails?: CharacterDetails;
  submitLabel: string;
  onSubmit: (details: CharacterDetails) => Promise<RosterChangeResult>;
  onCancel?: () => void;
}) => {
  const [name, setName] = useState(initialDetails.name);
  const [homeWorld, setHomeWorld] = useState(initialDetails.homeWorld);
  const [note, setNote] = useState(initialDetails.note ?? "");
  const [error, setError] = useState<RosterChangeError | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await onSubmit({ name, homeWorld, note });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Cleared for the next entry, for a form that stays open after its change is made.
    setName(initialDetails.name);
    setHomeWorld(initialDetails.homeWorld);
    setNote(initialDetails.note ?? "");
    setError(null);
  };

  return (
    <form className="entry-form" onSubmit={submit}>
      <label>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label>
        Home world
        <select
          value={homeWorld}
          onChange={(e) => setHomeWorld(e.target.value)}
          required
        >
          <option value="">Choose a world</option>
          {regions.flatMap((region) =>
            region.dataCenters.map((dataCenter) => (
              <optgroup
                key={dataCenter.name}
                label={`${dataCenter.name} (${region.name})`}
              >
                {dataCenter.worlds.map((world) => (
                  <option key={world} value={world}>
                    {world}
                  </option>
                ))}
              </optgroup>
            )),
          )}
        </select>
      </label>
      <label className="entry-form-wide">
        Note
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. goods need a manual meetup to reach the seller"
        />
      </label>
      <div className="entry-form-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {error && <RosterChangeErrorMessage error={error} />}
    </form>
  );
};
