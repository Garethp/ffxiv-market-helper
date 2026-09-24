import type { ReactNode } from "react";
import { useCopyText } from "../hooks/useCopyText";
import type { DisplayRow } from "../types";
import { formatGil } from "../utils/format";
import { GapBadge } from "./badges/GapBadge";
import { HighQualityBadge } from "./badges/HighQualityBadge";
import { UndercutBadge } from "./badges/UndercutBadge";
import { CopyButton } from "./CopyButton";
import { ExpandableList, ExpandableRow } from "./tables/ExpandableList";
import { ItemSummaryTooltip } from "./ItemSummaryTooltip";
import { Profit } from "./Profit";
import { Tooltip } from "./Tooltip";
import { UniversalisLink } from "./UniversalisLink";

const ProfitExpandableRow = ({
  displayRow: { row, isRefreshing },
  sellWorld,
  isCopied,
  onCopyName,
}: {
  displayRow: DisplayRow;
  sellWorld: string;
  isCopied: boolean;
  onCopyName: () => void;
}) => {
  const { item, analysis } = row;
  const pricing = analysis.status === "ready" ? analysis : undefined;

  const rowClasses = [
    pricing?.gapDetected ? "row-gap" : "",
    isRefreshing ? "row-refreshing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Each figure keyed by what it is, in the order shown. Typed by its own keys rather than as any
  // string, so looking up a figure that isn't here fails to compile.
  const detailFigures = {
    "Buy DC": pricing?.buy ? (
      <UniversalisLink
        itemId={item.itemId}
        worldOrDataCenter={pricing.buyDataCenter}
      >
        {pricing.buyDataCenter}
      </UniversalisLink>
    ) : (
      "—"
    ),
    "Buy price / unit": formatGil(pricing?.buy?.pricePerUnit),
    "Sell price": (
      <UniversalisLink itemId={item.itemId} worldOrDataCenter={sellWorld}>
        {formatGil(pricing?.sellPricePerUnit)}
      </UniversalisLink>
    ),
    "Profit / item": <Profit amount={pricing?.profitPerItem} />,
    "Profit / stack": <Profit amount={pricing?.profitPerStack} />,
    // Explained by the sale rate it's worked out from.
    "Expected profit / day": pricing ? (
      <Tooltip
        text={`Based on ${pricing.saleVelocityPerDay.toFixed(1)} sold in the last day`}
      >
        {(tooltipId) => (
          <span tabIndex={0} aria-describedby={tooltipId}>
            <Profit amount={pricing.expectedProfitPerDay} />
          </span>
        )}
      </Tooltip>
    ) : (
      <Profit />
    ),
  } satisfies Record<string, ReactNode>;

  const summaryFigures = {
    "Profit / stack": detailFigures["Profit / stack"],
    "Profit / day": detailFigures["Expected profit / day"],
  } satisfies Record<string, ReactNode>;

  return (
    <ExpandableRow
      heading={<ItemSummaryTooltip itemId={item.itemId} name={item.name} />}
      expandLabel={`Show every figure for ${item.name}`}
      className={rowClasses}
      summary={
        <dl className="profit-row-summary">
          {Object.entries(summaryFigures).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      }
      // Expanded, the row is a card of every figure, the summary's among them.
      details={
        <dl className="profit-row-details">
          {Object.entries(detailFigures).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      }
    >
      <div className="profit-row-badges">
        <CopyButton
          label="Copy item name"
          isCopied={isCopied}
          onCopy={onCopyName}
        />
        {item.hq ? <HighQualityBadge /> : null}
        {pricing?.gapDetected ? <GapBadge /> : null}
        {/* With the badges rather than the sell price, so it shows while the row is collapsed. */}
        {pricing?.sellListingStatus.state === "undercut" ? (
          <UndercutBadge status={pricing.sellListingStatus} />
        ) : null}
      </div>
    </ExpandableRow>
  );
};

/**
 * Each item in three lines, its name, its badges and then what it's worth a stack and a day,
 * opening up into a card of every figure when tapped.
 */
export const ProfitExpandableRows = ({
  rows,
  sellWorld,
}: {
  rows: DisplayRow[];
  sellWorld: string;
}) => {
  const { copiedKey, copyText } = useCopyText();

  return (
    <ExpandableList>
      {rows.map((displayRow) => {
        const { item } = displayRow.row;
        // An item can be priced as both NQ and HQ, but only once as each.
        const key = `${item.itemId}-${item.hq ? "hq" : "nq"}`;
        return (
          <ProfitExpandableRow
            key={key}
            displayRow={displayRow}
            sellWorld={sellWorld}
            isCopied={copiedKey === key}
            onCopyName={() => copyText(key, item.name)}
          />
        );
      })}
    </ExpandableList>
  );
};
