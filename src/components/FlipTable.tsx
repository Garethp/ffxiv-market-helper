import { useState } from "react";
import type { DisplayRow } from "../types";
import { FlipTableRow } from "./FlipTableRow";

export const FlipTable = ({
  rows,
  staleWarningThresholdMs,
  sellWorld,
}: {
  rows: DisplayRow[];
  staleWarningThresholdMs: number | null;
  sellWorld: string;
}) => {
  const [copiedItemId, setCopiedItemId] = useState<number | null>(null);

  const copyItemName = async (itemId: number, name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedItemId(itemId);
      setTimeout(
        () =>
          setCopiedItemId((current) => (current === itemId ? null : current)),
        1500,
      );
    } catch {
      // Clipboard access can be denied (permissions, non-secure context) — nothing to recover, just don't show "copied".
    }
  };

  return (
    <table className="flip-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Buy DC</th>
          <th>Buy price / unit</th>
          <th>Sell price</th>
          <th>Profit / item</th>
          <th>Profit / stack</th>
          <th>Expected profit / day</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((displayRow) => (
          <FlipTableRow
            key={displayRow.row.item.itemId}
            displayRow={displayRow}
            staleWarningThresholdMs={staleWarningThresholdMs}
            sellWorld={sellWorld}
            isCopied={copiedItemId === displayRow.row.item.itemId}
            onCopyName={() =>
              copyItemName(displayRow.row.item.itemId, displayRow.row.item.name)
            }
          />
        ))}
      </tbody>
    </table>
  );
};
