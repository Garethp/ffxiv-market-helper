import { useState, type FormEvent } from "react";
import type { CharacterDetails } from "../services/characterService";
import type { RosterValidationError } from "../utils/validation/roster";
import type { RegionInfo } from "../types";
import { ErrorMessage } from "./ErrorMessage";
import { RosterChangeErrorMessage } from "./RosterChangeErrorMessage";

const NO_DETAILS: CharacterDetails = { name: "", homeWorld: "" };

/** Enters a character's details, for adding a new character or changing an existing one. */
export const CharacterForm = ({
  regions,
  initialDetails = NO_DETAILS,
  submitLabel,
  validate,
  onSubmit,
  onCancel,
}: {
  regions: RegionInfo[];
  initialDetails?: CharacterDetails;
  submitLabel: string;
  /** Why the roster wouldn't accept these details, checked before anything is attempted. */
  validate: (details: CharacterDetails) => RosterValidationError | undefined;
  onSubmit: (details: CharacterDetails) => Promise<void>;
  onCancel?: () => void;
}) => {
  const [name, setName] = useState(initialDetails.name);
  const [homeWorld, setHomeWorld] = useState(initialDetails.homeWorld);
  const [note, setNote] = useState(initialDetails.note ?? "");
  const [invalid, setInvalid] = useState<RosterValidationError | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const details = { name, homeWorld, note };
    const reason = validate(details);
    setInvalid(reason ?? null);
    setHasFailed(false);
    // Nothing is attempted while the roster wouldn't accept it.
    if (reason) return;

    try {
      await onSubmit(details);
    } catch {
      setHasFailed(true);
      return;
    }
    // Cleared for the next entry, for a form that stays open after its change is made.
    setName(initialDetails.name);
    setHomeWorld(initialDetails.homeWorld);
    setNote(initialDetails.note ?? "");
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
      {invalid && <RosterChangeErrorMessage error={invalid} />}
      {hasFailed && (
        <ErrorMessage>Something went wrong. Try again shortly.</ErrorMessage>
      )}
    </form>
  );
};
