import { useState } from "react";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import { NumberInput } from "./forms/NumberInput";

/**
 * How long typing in a filter has to pause before it's reported, so a value
 * typed a character at a time (the "0" of "0.1") isn't applied along the way.
 */
const TYPING_PAUSE_MS = 300;

/**
 * A number field that keeps what's typed to itself, and reports it once
 * typing pauses. Only it redraws while typing, rather than whatever shows the
 * value's effect.
 */
const SettlingNumberField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  /** The value in use, which the field starts out showing. */
  value?: number;
  onChange: (value?: number) => void;
}) => {
  const [typed, setTyped] = useState(value);
  // Restarted by every key, not just by a change of value: "0" and "0." are
  // both 0, and the "0" mustn't be reported while the "." is being typed.
  const report = useDebouncedCallback((next?: number) => {
    if (next !== value) onChange(next);
  }, TYPING_PAUSE_MS);

  const handleChange = (next?: number) => {
    setTyped(next);
    report(next);
  };

  return (
    <label className="character-select">
      {label}
      <NumberInput
        min={0}
        placeholder="none"
        value={typed}
        onChange={handleChange}
      />
    </label>
  );
};

/** The limits on which listings are worth buying, each reported once typing in it pauses. */
export const ExpertDeliveryFilters = ({
  minimumSealsPerGil,
  onMinimumSealsPerGilChange,
  maximumPricePerUnit,
  onMaximumPricePerUnitChange,
}: {
  minimumSealsPerGil?: number;
  onMinimumSealsPerGilChange: (minimumSealsPerGil?: number) => void;
  maximumPricePerUnit?: number;
  onMaximumPricePerUnitChange: (maximumPricePerUnit?: number) => void;
}) => (
  <>
    <SettlingNumberField
      label="Minimum seals / gil"
      value={minimumSealsPerGil}
      onChange={onMinimumSealsPerGilChange}
    />
    <SettlingNumberField
      label="Maximum price"
      value={maximumPricePerUnit}
      onChange={onMaximumPricePerUnitChange}
    />
  </>
);
