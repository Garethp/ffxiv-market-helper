// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScannedItem, ScanStatus } from "../hooks/useHighVolumeItemScan";

vi.mock("../hooks/useHighVolumeItemScan");
vi.mock("../services/configService", () => ({
  configService: {
    getRegions: vi.fn().mockResolvedValue([]),
    getCharacters: vi.fn().mockResolvedValue([]),
    getDefaultCharacterName: vi.fn().mockResolvedValue(""),
    getTradingParameters: vi.fn().mockResolvedValue({
      sellHistoryFetchCount: 100,
      saleVelocityWindowMs: 86_400_000,
    }),
  },
}));
vi.mock("../api/xivapi", () => ({ fetchItemNames: vi.fn() }));

import { fetchItemNames } from "../api/xivapi";
import { useHighVolumeItemScan } from "../hooks/useHighVolumeItemScan";
import { HighVolumeItemsContainer } from "./HighVolumeItemsContainer";

const mockedUseHighVolumeItemScan = vi.mocked(useHighVolumeItemScan);
const mockedFetchItemNames = vi.mocked(fetchItemNames);

type ScanState = ReturnType<typeof useHighVolumeItemScan>;

/** A promise whose resolution is controlled from outside. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const statusAt = (scannedItems: number): ScanStatus => {
  return {
    state: "running",
    scannedItems,
    totalItems: 1000,
  };
};

afterEach(cleanup);

describe("HighVolumeItemsContainer", () => {
  it("should not lose an item name that finishes loading after newer scan results have already arrived", async () => {
    const item: ScannedItem = {
      itemId: 1,
      nqSaleVelocity: 500,
      hqSaleVelocity: 0,
      totalSaleVelocity: 500,
    };
    const results = [item];

    let setScanState!: (state: ScanState) => void;
    mockedUseHighVolumeItemScan.mockImplementation(() => {
      const [state, setState] = useState<ScanState>({
        status: statusAt(400),
        results,
        startScan: vi.fn(),
      });
      setScanState = setState;
      return state;
    });

    const nameLookup = deferred<Map<number, string>>();
    mockedFetchItemNames.mockReturnValue(nameLookup.promise);

    // StrictMode matches production (main.tsx) — its dev-mode double-invoke of effects on first
    // render is what this test guards against re-triggering a duplicate lookup.
    render(
      <StrictMode>
        <MemoryRouter>
          <HighVolumeItemsContainer />
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => expect(mockedFetchItemNames).toHaveBeenCalledWith([1]));

    // Another batch completes — a fresh status object, but nowhere near the next checkpoint —
    // while the lookup above is still in flight.
    await act(async () => {
      setScanState({
        status: statusAt(420),
        results,
        startScan: vi.fn(),
      });
    });

    // The lookup finally resolves. Its result should still be applied, not silently discarded.
    await act(async () => {
      nameLookup.resolve(new Map([[1, "Aetherpool Arm"]]));
    });

    await waitFor(() => screen.getByText("Aetherpool Arm"));
  });

  it("should still look up names for a final stretch too short to cross the interval on its own", async () => {
    const item: ScannedItem = {
      itemId: 2,
      nqSaleVelocity: 300,
      hqSaleVelocity: 0,
      totalSaleVelocity: 300,
    };
    const results = [item];

    let setScanState!: (state: ScanState) => void;
    mockedUseHighVolumeItemScan.mockImplementation(() => {
      const [state, setState] = useState<ScanState>({
        status: statusAt(150),
        results,
        startScan: vi.fn(),
      });
      setScanState = setState;
      return state;
    });

    mockedFetchItemNames.mockResolvedValue(
      new Map([[2, "Grade 8 Dark Matter"]]),
    );

    render(
      <MemoryRouter>
        <HighVolumeItemsContainer />
      </MemoryRouter>,
    );

    // Short of the next 200-item checkpoint — no lookup should fire yet.
    expect(mockedFetchItemNames).not.toHaveBeenCalled();

    // The scan finishes without the final stretch ever crossing the interval on its own.
    await act(async () => {
      setScanState({
        status: {
          state: "done",
          scannedItems: 150,
          totalItems: 1000,
          failedBatchCount: 0,
        },
        results,
        startScan: vi.fn(),
      });
    });

    await waitFor(() => screen.getByText("Grade 8 Dark Matter"));
  });

  describe("showing a previous scan", () => {
    const item: ScannedItem = {
      itemId: 3,
      nqSaleVelocity: 250,
      hqSaleVelocity: 50,
      totalSaleVelocity: 300,
    };
    const previousScan: ScanState = {
      status: {
        state: "previous",
        completedAt: Date.now(),
      },
      results: [item],
      startScan: vi.fn(),
    };

    it("should look up names for its results straight away", async () => {
      mockedUseHighVolumeItemScan.mockReturnValue(previousScan);
      mockedFetchItemNames.mockResolvedValue(new Map([[3, "Cordial"]]));

      render(
        <MemoryRouter>
          <HighVolumeItemsContainer />
        </MemoryRouter>,
      );

      await waitFor(() => screen.getByText("Cordial"));
    });
  });

  it("should stop the world being changed while a scan is running, so the results shown always belong to the selected world", async () => {
    mockedUseHighVolumeItemScan.mockReturnValue({
      status: statusAt(0),
      results: [],
      startScan: vi.fn(),
    });

    render(
      <MemoryRouter>
        <HighVolumeItemsContainer />
      </MemoryRouter>,
    );

    expect((screen.getByLabelText("World") as HTMLSelectElement).disabled).toBe(
      true,
    );
  });
});
