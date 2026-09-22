import { useCopyText } from "../hooks/useCopyText";
import type { DisplayRow } from "../types";
import { HintedColumnHeader } from "./tables/HintedColumnHeader";
import { profitColumnHints } from "./pricingHints";
import { ProfitTableRow } from "./ProfitTableRow";

export const ProfitTable = ({
  rows,
  sellWorld,
  gapThresholdMultiplier,
}: {
  rows: DisplayRow[];
  sellWorld: string;
  /** Explained in the sell price column's hint. */
  gapThresholdMultiplier: number;
}) => {
  const { copiedKey, copyText } = useCopyText();

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
        {rows.map((displayRow) => {
          const { item } = displayRow.row;
          // An item can be priced as both NQ and HQ, but only once as each.
          const key = `${item.itemId}-${item.hq ? "hq" : "nq"}`;
          return (
            <ProfitTableRow
              key={key}
              displayRow={displayRow}
              sellWorld={sellWorld}
              isCopied={copiedKey === key}
              onCopyName={() => copyText(key, item.name)}
            />
          );
        })}
      </tbody>
    </table>
  );
};
