import { useState, type FormEvent } from "react";
import type { RetainerDetails } from "../services/characterService";
import type { RosterValidationError } from "../utils/validation/roster";
import { ErrorMessage } from "./ErrorMessage";
import { RosterChangeErrorMessage } from "./RosterChangeErrorMessage";

const NO_DETAILS: RetainerDetails = { name: "", city: "" };

/** Enters a retainer's details, for adding a new retainer or changing an existing one. */
export const RetainerForm = ({
  marketBoardCities,
  initialDetails = NO_DETAILS,
  submitLabel,
  validate,
  onSubmit,
  onCancel,
}: {
  marketBoardCities: string[];
  initialDetails?: RetainerDetails;
  submitLabel: string;
  /** Why the character wouldn't accept this retainer, checked before anything is attempted. */
  validate: (details: RetainerDetails) => RosterValidationError | undefined;
  onSubmit: (details: RetainerDetails) => Promise<void>;
  onCancel?: () => void;
}) => {
  const [name, setName] = useState(initialDetails.name);
  const [city, setCity] = useState(initialDetails.city);
  const [invalid, setInvalid] = useState<RosterValidationError | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const details = { name, city };
    const reason = validate(details);
    setInvalid(reason ?? null);
    setHasFailed(false);
    // Nothing is attempted while the character wouldn't accept it.
    if (reason) return;

    try {
      await onSubmit(details);
    } catch {
      setHasFailed(true);
      return;
    }
    // Cleared for the next entry, for a form that stays open after its change is made.
    setName(initialDetails.name);
    setCity(initialDetails.city);
  };

  return (
    <form className="entry-form" onSubmit={submit}>
      <label>
        Retainer name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label>
        City
        <select value={city} onChange={(e) => setCity(e.target.value)} required>
          <option value="">Choose a city</option>
          {marketBoardCities.map((marketBoardCity) => (
            <option key={marketBoardCity} value={marketBoardCity}>
              {marketBoardCity}
            </option>
          ))}
        </select>
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
