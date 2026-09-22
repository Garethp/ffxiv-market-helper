import { useState, type MouseEvent } from "react";
import { buildMarketPageUrl } from "../api/universalis";
import { useCopyText } from "../hooks/useCopyText";
import type { DisplayRow } from "../types";
import { formatGil } from "../utils/format";
import { ItemSummaryTooltip } from "./ItemSummaryTooltip";
import { Tooltip } from "./Tooltip";
import { UndercutBadge } from "./UndercutBadge";

const staleTooltip = (
  lastSuccessAt: number | null,
  lastErrorMessage: string | null,
): string => {
  const age =
    lastSuccessAt === null
      ? "Data has never loaded successfully"
      : `Last good data from ${Math.round((Date.now() - lastSuccessAt) / 60_000)}m ago`;
  return lastErrorMessage
    ? `${age}. Latest fetch failed: ${lastErrorMessage}`
    : age;
};

const numberClass = (value: number | null): string => {
  if (value === null) return "";
  return value >= 0 ? "positive" : "negative";
};

const ExpandableRow = ({
  displayRow: { row, isRefreshing },
  staleWarningThresholdMs,
  sellWorld,
  isCopied,
  onCopyName,
}: {
  displayRow: DisplayRow;
  staleWarningThresholdMs: number | null;
  sellWorld: string;
  isCopied: boolean;
  onCopyName: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { item, analysis, lastSuccessAt, lastAttemptFailed, lastErrorMessage } =
    row;
  const pricing = analysis.status === "ready" ? analysis : null;
  const isStale =
    staleWarningThresholdMs !== null &&
    lastAttemptFailed &&
    (lastSuccessAt === null ||
      Date.now() - lastSuccessAt > staleWarningThresholdMs);

  const rowClasses = [
    "expandable-row",
    pricing?.gapDetected ? "row-gap" : "",
    isRefreshing ? "row-refreshing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const toggleExpanded = () => setIsExpanded((expanded) => !expanded);
  // Anywhere on the row expands it, bar the controls and links in it, which do their own thing.
  const onRowClick = (event: MouseEvent) => {
    if (!(event.target as Element).closest("a, button")) toggleExpanded();
  };

  return (
    <li className={rowClasses} onClick={onRowClick}>
      <div className="expandable-row-name">
        {/* The row itself can only be clicked, so this is how it's expanded without a pointer. */}
        <button
          type="button"
          className="expand-row-button"
          aria-expanded={isExpanded}
          aria-label={`Show every figure for ${item.name}`}
          onClick={toggleExpanded}
        >
          {isExpanded ? "▾" : "▸"}
        </button>
        <ItemSummaryTooltip itemId={item.itemId} name={item.name} />
      </div>
      <div className="expandable-row-badges">
        {/* Named by its tooltip, since the button itself is only an icon. */}
        <Tooltip text="Copy item name">
          {(tooltipId) => (
            <button
              type="button"
              className="copy-name-button"
              aria-labelledby={tooltipId}
              onClick={onCopyName}
            >
              📋
              {isCopied ? <span className="copy-tooltip">Copied!</span> : null}
            </button>
          )}
        </Tooltip>
        {item.hq ? (
          <Tooltip text="Priced as high quality">
            {(tooltipId) => (
              <span
                className="quality-badge"
                tabIndex={0}
                aria-describedby={tooltipId}
              >
                HQ
              </span>
            )}
          </Tooltip>
        ) : null}
        {pricing?.gapDetected ? (
          <Tooltip text="Current listings are well above recent sale prices — room to undercut">
            {(tooltipId) => (
              <span
                className="gap-badge"
                tabIndex={0}
                aria-describedby={tooltipId}
              >
                gap
              </span>
            )}
          </Tooltip>
        ) : null}
        {isStale ? (
          <Tooltip text={staleTooltip(lastSuccessAt, lastErrorMessage)}>
            {(tooltipId) => (
              <span
                className="stale-badge"
                tabIndex={0}
                aria-describedby={tooltipId}
              >
                ⚠
              </span>
            )}
          </Tooltip>
        ) : null}
      </div>
      {/* Expanded, the row is a card of every figure, the summary's among them. */}
      {isExpanded ? (
        <dl className="expandable-row-details">
          <dt>Buy DC</dt>
          <dd>
            {pricing?.buy ? (
              <a
                href={buildMarketPageUrl(item.itemId, pricing.buyDataCenter)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {pricing.buyDataCenter}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt>Buy price / unit</dt>
          <dd>{formatGil(pricing?.buy?.pricePerUnit ?? null)}</dd>
          <dt>Sell price</dt>
          <dd>
            {sellWorld ? (
              <a
                href={buildMarketPageUrl(item.itemId, sellWorld)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatGil(pricing?.sellPricePerUnit ?? null)}
              </a>
            ) : (
              formatGil(pricing?.sellPricePerUnit ?? null)
            )}
            {pricing && pricing.sellSampleSize > 0 && pricing.sellSampleSize < 3
              ? ` (n=${pricing.sellSampleSize})`
              : ""}
            {pricing?.sellListingStatus.state === "undercut" ? (
              <UndercutBadge status={pricing.sellListingStatus} />
            ) : null}
          </dd>
          <dt>Profit / item</dt>
          <dd className={numberClass(pricing?.profitPerItem ?? null)}>
            {formatGil(pricing?.profitPerItem ?? null)}
          </dd>
          <dt>Profit / stack</dt>
          <dd className={numberClass(pricing?.profitPerStack ?? null)}>
            {formatGil(pricing?.profitPerStack ?? null)}
          </dd>
          <dt>Expected profit / day</dt>
          <dd className={numberClass(pricing?.expectedProfitPerDay ?? null)}>
            {pricing ? (
              <Tooltip
                text={`Based on ${pricing.saleVelocityPerDay.toFixed(1)} sold in the last day`}
              >
                {(tooltipId) => (
                  <span tabIndex={0} aria-describedby={tooltipId}>
                    {formatGil(pricing.expectedProfitPerDay)}
                  </span>
                )}
              </Tooltip>
            ) : (
              formatGil(null)
            )}
          </dd>
        </dl>
      ) : (
        <dl className="expandable-row-profits">
          <div>
            <dt>Profit / stack</dt>
            <dd className={numberClass(pricing?.profitPerStack ?? null)}>
              {formatGil(pricing?.profitPerStack ?? null)}
            </dd>
          </div>
          <div>
            <dt>Profit / day</dt>
            <dd className={numberClass(pricing?.expectedProfitPerDay ?? null)}>
              {pricing ? (
                <Tooltip
                  text={`Based on ${pricing.saleVelocityPerDay.toFixed(1)} sold in the last day`}
                >
                  {(tooltipId) => (
                    <span tabIndex={0} aria-describedby={tooltipId}>
                      {formatGil(pricing.expectedProfitPerDay)}
                    </span>
                  )}
                </Tooltip>
              ) : (
                formatGil(null)
              )}
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
};

/**
 * Each item in three lines, its name, its badges and then what it's worth a stack and a day,
 * opening up into a card of every figure when tapped.
 */
export const ProfitExpandableRows = ({
  rows,
  staleWarningThresholdMs,
  sellWorld,
}: {
  rows: DisplayRow[];
  staleWarningThresholdMs: number | null;
  sellWorld: string;
}) => {
  const { copiedKey, copyText } = useCopyText();

  return (
    <ul className="expandable-rows">
      {rows.map((displayRow) => {
        const { item } = displayRow.row;
        // An item can be priced as both NQ and HQ, but only once as each.
        const key = `${item.itemId}-${item.hq ? "hq" : "nq"}`;
        return (
          <ExpandableRow
            key={key}
            displayRow={displayRow}
            staleWarningThresholdMs={staleWarningThresholdMs}
            sellWorld={sellWorld}
            isCopied={copiedKey === key}
            onCopyName={() => copyText(key, item.name)}
          />
        );
      })}
    </ul>
  );
};
