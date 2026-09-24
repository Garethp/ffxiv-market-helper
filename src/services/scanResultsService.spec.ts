// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanResultsService, type CompletedScan } from "./scanResultsService";

const buildScan = (
  worldOrDataCenter: string,
  completedAt: number,
): CompletedScan => ({
  worldOrDataCenter,
  completedAt,
  items: [{ itemId: 1, nqSaleVelocity: 12, hqSaleVelocity: 3 }],
});

describe("scanResultsService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should keep the latest scan of each world separately", async () => {
    const chaos = buildScan("Chaos", Date.now());
    const omega = buildScan("Omega", Date.now());
    await scanResultsService.saveScan(chaos);
    await scanResultsService.saveScan(omega);

    expect(await scanResultsService.getLatestScan("Chaos")).toEqual(chaos);
    expect(await scanResultsService.getLatestScan("Omega")).toEqual(omega);
  });

  it("should replace a world's previous scan when it's scanned again", async () => {
    await scanResultsService.saveScan(buildScan("Chaos", Date.now() - 60_000));
    const latest = buildScan("Chaos", Date.now());
    await scanResultsService.saveScan(latest);

    expect(await scanResultsService.getLatestScan("Chaos")).toEqual(latest);
  });

  it("should stop returning a scan once it's 12 hours old", async () => {
    await scanResultsService.saveScan(buildScan("Chaos", Date.now()));

    vi.setSystemTime(new Date("2026-09-17T11:59:00Z"));
    expect(await scanResultsService.getLatestScan("Chaos")).not.toBeUndefined();

    vi.setSystemTime(new Date("2026-09-17T12:00:00Z"));
    expect(await scanResultsService.getLatestScan("Chaos")).toBeUndefined();
  });

  it("should clear out scans too old to show when saving a new one, to leave room for it", async () => {
    await scanResultsService.saveScan(buildScan("Chaos", Date.now()));
    await scanResultsService.saveScan(buildScan("Omega", Date.now()));

    vi.setSystemTime(new Date("2026-09-17T13:00:00Z"));
    await scanResultsService.saveScan(buildScan("Louisoix", Date.now()));

    expect(localStorage.length).toBe(1);
  });

  it("should treat unreadable saved data as having no saved scan", async () => {
    await scanResultsService.saveScan(buildScan("Chaos", Date.now()));
    localStorage.setItem(localStorage.key(0)!, "{not json");

    expect(await scanResultsService.getLatestScan("Chaos")).toBeUndefined();
  });
});
