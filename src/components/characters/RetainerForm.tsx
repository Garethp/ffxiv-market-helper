import { useState, type FormEvent } from "react";
import type { RetainerDetails } from "../../services/characterService";
import { ErrorMessage } from "../ErrorMessage";

/**
 * Enters a retainer's details, for adding a new retainer or changing an
 * existing one. Holds nothing but the fields: whether the details are ones the
 * character would accept, and what to say when they aren't, is the caller's to
 * decide and pass back as `errorMessage`.
 */
export const RetainerForm = ({
  label,
  marketBoardCities,
  initial,
  submitLabel,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  /** Names the form, e.g. "Edit Amarana". */
  label: string;
  marketBoardCities: string[];
  initial: RetainerDetails;
  submitLabel: string;
  /** Why the details last submitted weren't taken, if they weren't. */
  errorMessage?: string;
  onSubmit: (details: RetainerDetails) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initial.name);
  const [city, setCity] = useState(initial.city);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name, city });
  };

  return (
    <form
      aria-label={label}
      className="entry-form entry-form-stacked"
      onSubmit={submit}
    >
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
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
    </form>
  );
};
