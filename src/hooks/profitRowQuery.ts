import {
  queryOptions,
  skipToken,
  type QueryObserverResult,
} from "@tanstack/react-query";
import {
  analyzeRow,
  fetchRowMarketData,
  type RowMarketData,
} from "../services/rowAnalysis";
import type { TradingConfig } from "../services/tradingConfig";
import type { Character, ProfitRow, TrackedItem } from "../types";

/**
 * The market data for one item bought via one region, sold through the given
 * character. Nothing is fetched without a character to sell through.
 */
export const rowMarketDataQuery = (
  itemId: number,
  region: string,
  sellingCharacter: Character | null,
  config: TradingConfig,
) =>
  queryOptions({
    // Only the sell world decides what's fetched, and config never changes once loaded.
    queryKey: ["rowMarketData", itemId, region, sellingCharacter?.homeWorld],
    // Reading the signal is what makes TanStack Query cancel the fetch once nothing wants the
    // row any more, e.g. its page closed or the character selling it changed.
    queryFn: sellingCharacter
      ? ({ client, signal }) =>
          fetchRowMarketData(
            client,
            itemId,
            region,
            sellingCharacter,
            config.regions,
            config.params,
            signal,
          )
      : skipToken,
  });

/**
 * Prices the item from however far its market data query has got. A failed
 * fetch never replaces the last good data: it keeps showing, flagged as
 * possibly out of date.
 */
export const profitRow = (
  query: Pick<
    QueryObserverResult<RowMarketData>,
    "data" | "dataUpdatedAt" | "error"
  >,
  item: TrackedItem,
  sellingCharacter: Character,
  config: TradingConfig,
): ProfitRow => ({
  item,
  analysis:
    query.data === undefined
      ? { status: "pending" }
      : analyzeRow(
          query.data,
          item,
          sellingCharacter,
          config.ownRetainers,
          config.params,
        ),
  lastSuccessAt: query.data === undefined ? null : query.dataUpdatedAt,
  lastAttemptFailed: query.error !== null,
  lastErrorMessage: query.error?.message ?? null,
});
