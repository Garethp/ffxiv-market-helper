import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

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
    <CopyButton label="Copy item name" isCopied={isCopied} onCopy={onCopy} />
    {name}
  </>
);
