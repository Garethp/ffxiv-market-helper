import type { ReactNode } from "react";
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
