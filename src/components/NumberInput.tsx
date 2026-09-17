import { useState, type InputHTMLAttributes } from "react";
import { formatAmount, parseAmount } from "../utils/amount";

type PassThroughProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "onFocus" | "onBlur" | "min"
>;

/**
 * A number field that also accepts gil-style shorthand ("500k", "1.5m"), but
 * otherwise behaves like a controlled input of a plain number: `onChange`
 * only ever receives a number, or undefined once the field is cleared.
 *
 * While being edited it shows exactly what's typed, reporting each value
 * that reads as a valid amount along the way — anything that doesn't (a
 * half-typed "1." aside, which reads fine) is ignored. Once it loses focus it
 * goes back to showing the current value, tidied up (e.g. "500000" becomes
 * "500k").
 */
export const NumberInput = ({
  value,
  onChange,
  min,
  className,
  ...inputProps
}: PassThroughProps & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Amounts below this are ignored, as if they weren't valid. */
  min?: number;
}) => {
  // What's being typed, while the field is focused. Kept apart from `value` so
  // text that doesn't read as an amount yet (or that the consumer adjusts)
  // isn't overwritten mid-edit.
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = value === undefined ? "" : formatAmount(value);

  return (
    <input
      {...inputProps}
      type="text"
      className={["number-input", className].filter(Boolean).join(" ")}
      value={draft ?? displayed}
      onFocus={() => setDraft(displayed)}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const parsed = parseAmount(text);
        if (parsed.status === "empty") {
          onChange(undefined);
        } else if (
          parsed.status === "valid" &&
          (min === undefined || parsed.value >= min)
        ) {
          onChange(parsed.value);
        }
      }}
    />
  );
};
