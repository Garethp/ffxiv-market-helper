import { buildMarketPageUrl } from "../api/universalis";
import type { DisplayRow } from "../types";
import { formatGil } from "../utils/format";
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
        <button
          type="button"
          className="copy-name-button"
          title="Copy item name"
          onClick={onCopyName}
        >
          📋
          {isCopied ? <span className="copy-tooltip">Copied!</span> : null}
        </button>
        {pricing?.gapDetected ? (
          <span
            className="gap-badge"
            title="Current listings are well above recent sale prices — room to undercut"
          >
            gap
          </span>
        ) : null}
        {isStale ? (
          <span
            className="stale-badge"
            title={staleTooltip(lastSuccessAt, lastErrorMessage)}
          >
            ⚠
          </span>
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
        {pricing?.sellPriceSource === "listings" ? " (listed)" : ""}
        {pricing?.sellPriceCapped ? " (capped)" : ""}
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
      <td
        className={numberClass(pricing?.expectedProfitPerDay ?? null)}
        title={
          pricing
            ? `Based on ${pricing.saleVelocityPerDay.toFixed(1)} sold in the last day`
            : undefined
        }
      >
        {formatGil(pricing?.expectedProfitPerDay ?? null)}
      </td>
    </tr>
  );
};
