import { useState, type FormEvent } from "react";
import type { CharacterDetails } from "../../services/characterService";
import type { RegionInfo } from "../../types";
import { ErrorMessage } from "../ErrorMessage";

/**
 * Enters a character's details, for adding a new character or changing an
 * existing one. Holds nothing but the fields: whether the details are ones the
 * roster would accept, and what to say when they aren't, is the caller's to
 * decide and pass back as `errorMessage`.
 */
export const CharacterForm = ({
  label,
  regions,
  initial,
  submitLabel,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  /** Names the form, e.g. "Edit Alice". */
  label: string;
  regions: RegionInfo[];
  initial: CharacterDetails;
  submitLabel: string;
  /** Why the details last submitted weren't taken, if they weren't. */
  errorMessage?: string | null;
  onSubmit: (details: CharacterDetails) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initial.name);
  const [homeWorld, setHomeWorld] = useState(initial.homeWorld);
  const [note, setNote] = useState(initial.note ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name, homeWorld, note });
  };

  return (
    <form
      aria-label={label}
      className="entry-form entry-form-stacked"
      onSubmit={submit}
    >
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
      <label>
        Note
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. goods need a manual meetup to reach the seller"
        />
      </label>
      <div className="entry-form-actions">
        <button type="submit">{submitLabel}</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
    </form>
  );
};
