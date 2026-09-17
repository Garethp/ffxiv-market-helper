import { useId, useState, type FormEvent } from "react";
import type {
  TrackedItemChangeError,
  TrackedItemChangeResult,
  TrackedItemSettings,
} from "../services/trackedItemService";
import { HintedField } from "./Hint";
import { NumberInput } from "./NumberInput";
import { pricingHints } from "./pricingHints";
import { TrackedItemChangeErrorMessage } from "./TrackedItemChangeErrorMessage";

type Quality = "NQ" | "HQ";

/** Enters how an item is tracked, for tracking a new item or changing one that's already tracked. */
export const TrackedItemSettingsForm = ({
  label,
  initial,
  submitLabel,
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
  onSubmit: (settings: TrackedItemSettings) => Promise<TrackedItemChangeResult>;
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
  const [error, setError] = useState<TrackedItemChangeError | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await onSubmit({
      hq: quality === "HQ",
      // An empty target quantity is refused like any other that isn't at least 1.
      targetQuantity: targetQuantity ?? 0,
      sellPriceCeiling,
    });
    setError(result.ok ? null : result.error);
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
      {error && <TrackedItemChangeErrorMessage error={error} />}
    </form>
  );
};
