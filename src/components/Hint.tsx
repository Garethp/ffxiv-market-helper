import { useId, type ReactNode } from "react";
import { Tooltip } from "./Tooltip";

/** A small "?" that explains what `about` means, shown on hover or when focused. */
export const Hint = ({
  about,
  children,
}: {
  about: string;
  children: ReactNode;
}) => (
  <Tooltip text={children}>
    {(tooltipId) => (
      <button
        type="button"
        className="hint-icon"
        aria-label={`About ${about.toLowerCase()}`}
        aria-describedby={tooltipId}
      >
        ?
      </button>
    )}
  </Tooltip>
);

/**
 * A labelled field with a hint beside its label. The hint sits outside the
 * label, since a button inside one would take the label over from the field.
 */
export const HintedField = ({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint: ReactNode;
  className?: string;
  /** Renders the field itself, given the ID its label points to. */
  children: (id: string) => ReactNode;
}) => {
  const id = useId();
  return (
    <div className={["hinted-field", className].filter(Boolean).join(" ")}>
      <span className="hinted-field-label">
        <label htmlFor={id}>{label}</label>
        <Hint about={label}>{hint}</Hint>
      </span>
      {children(id)}
    </div>
  );
};
