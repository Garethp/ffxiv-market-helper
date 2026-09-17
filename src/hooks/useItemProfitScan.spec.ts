// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TradingConfig } from "../services/tradingConfig";

vi.mock("../api/xivapi", () => ({ fetchItemNames: vi.fn() }));
vi.mock("../services/rowAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/rowAnalysis")>();
  return { ...actual, fetchRowAnalysis: vi.fn() };
});
vi.mock("../services/tradingConfig", () => ({ loadTradingConfig: vi.fn() }));

import { fetchItemNames } from "../api/xivapi";
import { fetchRowAnalysis } from "../services/rowAnalysis";
import { loadTradingConfig } from "../services/tradingConfig";
import { useItemProfitScan } from "./useItemProfitScan";

const mockedFetchItemNames = vi.mocked(fetchItemNames);
const mockedFetchRowAnalysis = vi.mocked(fetchRowAnalysis);
const mockedLoadTradingConfig = vi.mocked(loadTradingConfig);

/** A promise whose resolution is controlled from outside, to pin down fetch-ordering races. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const itemId = 42;

describe("useItemProfitScan", () => {
  beforeEach(() => {
    mockedLoadTradingConfig.mockResolvedValue({
      characters: [{ name: "Alice", homeWorld: "WorldA", retainers: [] }],
      regions: [],
      params: {} as TradingConfig["params"],
      defaultCharacterName: "Alice",
      buyingRegions: [{ region: "Europe", characters: [{ name: "Alice" }] }],
      ownRetainers: [],
    });
  });

  it("should keep the item's real name even though a fetch that started before the name was known finishes afterward", async () => {
    const name = deferred<Map<number, string>>();
    mockedFetchItemNames.mockReturnValue(name.promise);

    const rowAnalysis =
      deferred<Awaited<ReturnType<typeof fetchRowAnalysis>>>();
    mockedFetchRowAnalysis.mockReturnValue(rowAnalysis.promise);

    const { result } = renderHook(() => useItemProfitScan(itemId));

    // Config resolves and the auto-scan starts before the item's real name is known.
    await waitFor(() => expect(mockedFetchRowAnalysis).toHaveBeenCalled());
    expect(result.current.rowsByRegion["Europe"]?.[0]?.row.item.name).toBe(
      `Item #${itemId}`,
    );

    // The name arrives while that region's fetch is still pending.
    await act(async () => {
      name.resolve(new Map([[itemId, "Real Item Name"]]));
    });
    await waitFor(() =>
      expect(result.current.rowsByRegion["Europe"]?.[0]?.row.item.name).toBe(
        "Real Item Name",
      ),
    );

    // The in-flight fetch, started before the name was known, settles afterward.
    await act(async () => {
      rowAnalysis.resolve({
        success: true,
        analysis: { status: "pending" },
      });
    });

    expect(result.current.rowsByRegion["Europe"]?.[0]?.row.item.name).toBe(
      "Real Item Name",
    );
  });
});
