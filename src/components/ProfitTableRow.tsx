import type { DisplayRow } from "../types";
import { formatGil } from "../utils/format";
import { GapBadge } from "./badges/GapBadge";
import { HighQualityBadge } from "./badges/HighQualityBadge";
import { UndercutBadge } from "./badges/UndercutBadge";
import { ItemNameWithCopy } from "./ItemNameWithCopy";
import { ItemSummaryTooltip } from "./ItemSummaryTooltip";
import { Profit } from "./Profit";
import { Tooltip } from "./Tooltip";
import { UniversalisLink } from "./UniversalisLink";

export const ProfitTableRow = ({
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

  return (
    <tr className={rowClasses}>
      <td>
        <ItemNameWithCopy
          name={<ItemSummaryTooltip itemId={item.itemId} name={item.name} />}
          isCopied={isCopied}
          onCopy={onCopyName}
        />
        {item.hq ? <HighQualityBadge /> : null}
        {pricing?.gapDetected ? <GapBadge /> : null}
      </td>
      <td>
        {pricing?.buy ? (
          <UniversalisLink
            itemId={item.itemId}
            worldOrDataCenter={pricing.buyDataCenter}
          >
            {pricing.buyDataCenter}
          </UniversalisLink>
        ) : (
          "—"
        )}
      </td>
      <td>{formatGil(pricing?.buy?.pricePerUnit)}</td>
      <td>
        <UniversalisLink itemId={item.itemId} worldOrDataCenter={sellWorld}>
          {formatGil(pricing?.sellPricePerUnit)}
        </UniversalisLink>
        {pricing?.sellListingStatus.state === "undercut" ? (
          <UndercutBadge status={pricing.sellListingStatus} />
        ) : null}
      </td>
      <td>
        <Profit amount={pricing?.profitPerItem} />
      </td>
      <td>
        <Profit amount={pricing?.profitPerStack} />
      </td>
      <td>
        {pricing ? (
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
        )}
      </td>
    </tr>
  );
};
