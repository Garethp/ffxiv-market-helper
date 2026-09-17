import { useState, type ReactNode } from "react";
import type { DisplayRow } from "../types";
import { Hint } from "./Hint";
import { profitColumnHints } from "./pricingHints";
import { ProfitTableRow } from "./ProfitTableRow";

/**
 * A column header with a hint explaining how the column is worked out. Named
 * after the column alone, so the explanation isn't read out with every cell.
 */
const HintedColumnHeader = ({
  name,
  hint,
}: {
  name: string;
  hint: ReactNode;
}) => (
  <th aria-label={name}>
    {name} <Hint about={name}>{hint}</Hint>
  </th>
);

export const ProfitTable = ({
  rows,
  staleWarningThresholdMs,
  sellWorld,
  gapThresholdMultiplier,
}: {
  rows: DisplayRow[];
  staleWarningThresholdMs: number | null;
  sellWorld: string;
  /** Explained in the sell price column's hint. */
  gapThresholdMultiplier: number;
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
    <table className="item-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Buy DC</th>
          <HintedColumnHeader
            name="Buy price / unit"
            hint={profitColumnHints.buyPrice}
          />
          <HintedColumnHeader
            name="Sell price"
            hint={profitColumnHints.sellPrice(gapThresholdMultiplier)}
          />
          <HintedColumnHeader
            name="Profit / item"
            hint={profitColumnHints.profitPerItem}
          />
          <th>Profit / stack</th>
          <HintedColumnHeader
            name="Expected profit / day"
            hint={profitColumnHints.expectedProfitPerDay}
          />
        </tr>
      </thead>
      <tbody>
        {rows.map((displayRow) => (
          <ProfitTableRow
            // An item can be priced as both NQ and HQ, but only once as each.
            key={`${displayRow.row.item.itemId}-${displayRow.row.item.hq ? "hq" : "nq"}`}
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
