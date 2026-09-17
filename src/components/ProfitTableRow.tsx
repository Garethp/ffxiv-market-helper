import { buildMarketPageUrl } from "../api/universalis";
import type { DisplayRow } from "../types";
import { formatGil } from "../utils/format";
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

export const ProfitTableRow = ({
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
  const { item, analysis, lastSuccessAt, lastAttemptFailed, lastErrorMessage } =
    row;
  const pricing = analysis.status === "ready" ? analysis : null;
  const isStale =
    staleWarningThresholdMs !== null &&
    lastAttemptFailed &&
    (lastSuccessAt === null ||
      Date.now() - lastSuccessAt > staleWarningThresholdMs);

  const rowClasses = [
    pricing?.gapDetected ? "row-gap" : "",
    isRefreshing ? "row-refreshing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr className={rowClasses}>
      <td>
        {item.name}
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
      </td>
      <td>
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
      </td>
      <td>{formatGil(pricing?.buy?.pricePerUnit ?? null)}</td>
      <td>
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
      </td>
      <td className={numberClass(pricing?.profitPerItem ?? null)}>
        {formatGil(pricing?.profitPerItem ?? null)}
      </td>
      <td className={numberClass(pricing?.profitPerStack ?? null)}>
        {formatGil(pricing?.profitPerStack ?? null)}
      </td>
      <td className={numberClass(pricing?.expectedProfitPerDay ?? null)}>
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
      </td>
    </tr>
  );
};
