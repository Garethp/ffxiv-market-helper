import { useId, useState, type FormEvent } from "react";
import type { TrackedItemSettings } from "../../services/trackedItemService";
import { ErrorMessage } from "../ErrorMessage";
import { HintedField } from "../forms/HintedField";
import { NumberInput } from "../forms/NumberInput";
import { pricingHints } from "../pricingHints";

type Quality = "NQ" | "HQ";

/**
 * Enters how an item is tracked, for tracking a new item or changing one that's
 * already tracked. Holds nothing but the fields: whether the settings are ones
 * the tracked items would accept, and what to say when they aren't, is the
 * caller's to decide and pass back as `errorMessage`.
 */
export const TrackedItemSettingsForm = ({
  label,
  initial,
  submitLabel,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  /** Names the form, e.g. "Track Cordial". */
  label: string;
  initial: {
    /** Null when NQ or HQ still has to be chosen. */
    quality: Quality | null;
    targetQuantity: number;
    sellPriceCeiling?: number;
  };
  submitLabel: string;
  /** Why the settings last submitted weren't taken, if they weren't. */
  errorMessage?: string | null;
  onSubmit: (settings: TrackedItemSettings) => void;
  onCancel: () => void;
}) => {
  const qualityName = useId();
  const [quality, setQuality] = useState(initial.quality);
  const [targetQuantity, setTargetQuantity] = useState<number | undefined>(
    initial.targetQuantity,
  );
  const [sellPriceCeiling, setSellPriceCeiling] = useState(
    initial.sellPriceCeiling,
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      hq: quality === "HQ",
      // An empty target quantity is passed on like any other that isn't at least 1.
      targetQuantity: targetQuantity ?? 0,
      sellPriceCeiling,
    });
  };

  return (
    <form aria-label={label} className="entry-form" onSubmit={submit}>
      <fieldset className="quality-choice">
        <legend>Quality</legend>
        {(["NQ", "HQ"] as const).map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={qualityName}
              checked={quality === option}
              onChange={() => setQuality(option)}
            />
            {option}
          </label>
        ))}
      </fieldset>
      <HintedField label="Target quantity" hint={pricingHints.targetQuantity}>
        {(id) => (
          <NumberInput
            id={id}
            min={1}
            value={targetQuantity}
            onChange={setTargetQuantity}
          />
        )}
      </HintedField>
      <HintedField
        label="Sell price ceiling"
        hint={pricingHints.sellPriceCeiling}
      >
        {(id) => (
          <NumberInput
            id={id}
            min={0}
            placeholder="none"
            value={sellPriceCeiling}
            onChange={setSellPriceCeiling}
          />
        )}
      </HintedField>
      <div className="entry-form-actions">
        <button type="submit" disabled={quality === null}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
    </form>
  );
};
