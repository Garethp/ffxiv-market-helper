import type { ReactNode } from "react";
import { Tooltip } from "./Tooltip";

/** An item's name, led by a button that copies it, so the buttons line up down a column. */
export const ItemNameWithCopy = ({
  name,
  isCopied,
  onCopy,
}: {
  name: ReactNode;
  isCopied: boolean;
  onCopy: () => void;
}) => (
  <>
    {/* Named by its tooltip, since the button itself is only an icon. */}
    <Tooltip text="Copy item name">
      {(tooltipId) => (
        <button
          type="button"
          className="copy-name-button"
          aria-labelledby={tooltipId}
          onClick={onCopy}
        >
          📋
          {isCopied ? <span className="copy-tooltip">Copied!</span> : null}
        </button>
      )}
    </Tooltip>
    {name}
  </>
);
