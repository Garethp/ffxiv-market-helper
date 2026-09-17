import { useState, type FormEvent } from "react";
import type {
  RetainerDetails,
  RosterChangeError,
  RosterChangeResult,
} from "../services/characterService";
import { RosterChangeErrorMessage } from "./RosterChangeErrorMessage";

const NO_DETAILS: RetainerDetails = { name: "", city: "" };

/** Enters a retainer's details, for adding a new retainer or changing an existing one. */
export const RetainerForm = ({
  marketBoardCities,
  initialDetails = NO_DETAILS,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  marketBoardCities: string[];
  initialDetails?: RetainerDetails;
  submitLabel: string;
  onSubmit: (details: RetainerDetails) => Promise<RosterChangeResult>;
  onCancel?: () => void;
}) => {
  const [name, setName] = useState(initialDetails.name);
  const [city, setCity] = useState(initialDetails.city);
  const [error, setError] = useState<RosterChangeError | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await onSubmit({ name, city });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Cleared for the next entry, for a form that stays open after its change is made.
    setName(initialDetails.name);
    setCity(initialDetails.city);
    setError(null);
  };

  return (
    <form className="roster-form" onSubmit={submit}>
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
      <div className="roster-form-actions">
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
