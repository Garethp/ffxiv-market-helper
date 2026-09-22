import { Tooltip } from "./Tooltip";

/** A button that copies something, confirming for a moment once it has. */
export const CopyButton = ({
  label,
  isCopied,
  onCopy,
}: {
  /** What the button does, e.g. "Copy item name". */
  label: string;
  isCopied: boolean;
  onCopy: () => void;
}) => (
  // Named by its tooltip, since the button itself is only an icon.
  <Tooltip text={label}>
    {(tooltipId) => (
      <button
        type="button"
        className="copy-button"
        aria-labelledby={tooltipId}
        onClick={onCopy}
      >
        📋
        {isCopied ? <span className="copy-tooltip">Copied!</span> : null}
      </button>
    )}
  </Tooltip>
);
