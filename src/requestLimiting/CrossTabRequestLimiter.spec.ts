import { describe, expect, it } from "vitest";
import { CrossTabRequestLimiter } from "./CrossTabRequestLimiter";
import { InMemoryLockManager } from "./InMemoryLockManager";
import type {
  RequestLimiter,
  RequestLimits,
  RequestPriority,
} from "./RequestLimiter";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Two limiters sharing one lock manager, the way two tabs share navigator.locks. */
const openTwoTabs = (limits: RequestLimits) => {
  const locks = new InMemoryLockManager();
  return [
    new CrossTabRequestLimiter("test-api", limits, locks),
    new CrossTabRequestLimiter("test-api", limits, locks),
  ];
};

/** Acquires a permit, runs a pretend request for durationMs, then releases it. */
const runRequest = async (
  limiter: RequestLimiter,
  priority: RequestPriority,
  durationMs: number,
  onStart: () => void = () => {},
) => {
  const release = await limiter.acquire(priority);
  onStart();
  await sleep(durationMs);
  release();
};

describe("CrossTabRequestLimiter", () => {
  describe("sharing a budget across tabs", () => {
    it("should never allow more requests in flight at once than the concurrency limit, counting every tab", async () => {
      const tabs = openTwoTabs({ maxConcurrent: 3, maxRequestsPerSecond: 100 });
      let active = 0;
      let maxActive = 0;

      await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const release = await tabs[i % 2].acquire("interactive");
          active++;
          maxActive = Math.max(maxActive, active);
          await sleep(30);
          active--;
          release();
        }),
      );

      expect(maxActive).toBe(3);
    });

    it("should never start more requests than the rate limit within any one-second window, counting every tab", async () => {
      const tabs = openTwoTabs({ maxConcurrent: 50, maxRequestsPerSecond: 10 });
      const starts: number[] = [];

      await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          runRequest(tabs[i % 2], "interactive", 15, () =>
            starts.push(Date.now()),
          ),
        ),
      );

      const worstWindowCount = starts.reduce((worst, windowStart) => {
        const count = starts.filter(
          (t) => t >= windowStart && t < windowStart + 1000,
        ).length;
        return Math.max(worst, count);
      }, 0);
      expect(worstWindowCount).toBeLessThanOrEqual(10);
    });

    it("should keep limiters with different names on separate budgets", async () => {
      const locks = new InMemoryLockManager();
      const limits = { maxConcurrent: 1, maxRequestsPerSecond: 100 };
      const first = new CrossTabRequestLimiter("first-api", limits, locks);
      const second = new CrossTabRequestLimiter("second-api", limits, locks);

      const releaseFirst = await first.acquire("interactive");
      const releaseSecond = await second.acquire("interactive");

      releaseFirst();
      releaseSecond();
    });
  });

  describe("prioritising requests", () => {
    it("should let background requests start together in a burst when nothing interactive is waiting", async () => {
      const [tab] = openTwoTabs({ maxConcurrent: 5, maxRequestsPerSecond: 20 });
      const starts: number[] = [];

      await Promise.all(
        Array.from({ length: 5 }, () =>
          runRequest(tab, "background", 50, () => starts.push(Date.now())),
        ),
      );

      const spread = Math.max(...starts) - Math.min(...starts);
      expect(spread).toBeLessThan(15);
    });

    it("should start interactive requests ahead of background requests that were already waiting, other than one already queued for a slot", async () => {
      const [scanTab, itemTab] = openTwoTabs({
        maxConcurrent: 1,
        maxRequestsPerSecond: 100,
      });
      const startOrder: RequestPriority[] = [];
      const recordStart = (priority: RequestPriority) => () =>
        startOrder.push(priority);

      const releaseBlocker = await scanTab.acquire("background");
      const requests = Array.from({ length: 5 }, () =>
        runRequest(scanTab, "background", 5, recordStart("background")),
      );
      await sleep(10);
      requests.push(
        ...Array.from({ length: 2 }, () =>
          runRequest(itemTab, "interactive", 5, recordStart("interactive")),
        ),
      );
      await sleep(10);
      releaseBlocker();
      await Promise.all(requests);

      expect(startOrder).toEqual([
        "background",
        "interactive",
        "interactive",
        "background",
        "background",
        "background",
        "background",
      ]);
    });
  });
});
