import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/**
 * Runs the fake clock until every pending timer (the pretend requests, the limiter's one-second
 * rate locks) has fired, then waits for the work itself to finish.
 */
const runToCompletion = async <T>(work: Promise<T>): Promise<T> => {
  await vi.runAllTimersAsync();
  return work;
};

describe("CrossTabRequestLimiter", () => {
  // The limiter frees its rate locks with setTimeout. On a fake clock (which fakes Date.now too) the
  // timing these tests check is exact rather than at the mercy of how busy the machine is, and the
  // one-second waits take no real time.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("sharing a budget across tabs", () => {
    it("should never allow more requests in flight at once than the concurrency limit, counting every tab", async () => {
      const tabs = openTwoTabs({ maxConcurrent: 3, maxRequestsPerSecond: 100 });
      let active = 0;
      let maxActive = 0;

      await runToCompletion(
        Promise.all(
          Array.from({ length: 12 }, async (_, i) => {
            const release = await tabs[i % 2].acquire("interactive");
            active++;
            maxActive = Math.max(maxActive, active);
            await sleep(30);
            active--;
            release();
          }),
        ),
      );

      expect(maxActive).toBe(3);
    });

    it("should never start more requests than the rate limit within any one-second window, counting every tab", async () => {
      const tabs = openTwoTabs({ maxConcurrent: 50, maxRequestsPerSecond: 10 });
      const startedAt = Date.now();
      const starts: number[] = [];

      await runToCompletion(
        Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            runRequest(tabs[i % 2], "interactive", 15, () =>
              starts.push(Date.now() - startedAt),
            ),
          ),
        ),
      );

      // Ten use up the budget straight away. The other two wait for the first rate locks to come
      // back, one second after they were taken.
      expect(starts).toEqual([...Array<number>(10).fill(0), 1000, 1000]);
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
      const startedAt = Date.now();
      const starts: number[] = [];

      await runToCompletion(
        Promise.all(
          Array.from({ length: 5 }, () =>
            runRequest(tab, "background", 50, () =>
              starts.push(Date.now() - startedAt),
            ),
          ),
        ),
      );

      expect(starts).toEqual([0, 0, 0, 0, 0]);
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
      await vi.advanceTimersByTimeAsync(10);
      requests.push(
        ...Array.from({ length: 2 }, () =>
          runRequest(itemTab, "interactive", 5, recordStart("interactive")),
        ),
      );
      await vi.advanceTimersByTimeAsync(10);
      releaseBlocker();
      await runToCompletion(Promise.all(requests));

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

  describe("cancelling a wait", () => {
    it("should reject with the abort reason when aborted before a permit is granted", async () => {
      const [tab] = openTwoTabs({
        maxConcurrent: 1,
        maxRequestsPerSecond: 100,
      });
      const release = await tab.acquire("interactive");

      const controller = new AbortController();
      const waiting = tab.acquire("background", controller.signal);
      controller.abort(new Error("abandoned"));

      await expect(waiting).rejects.toThrow("abandoned");
      release();
    });

    it("should not let a cancelled wait hold up requests queued behind it", async () => {
      const [scanTab, itemTab] = openTwoTabs({
        maxConcurrent: 1,
        maxRequestsPerSecond: 100,
      });
      const releaseBlocker = await itemTab.acquire("interactive");

      const controller = new AbortController();
      const cancelled = scanTab
        .acquire("background", controller.signal)
        .catch(() => undefined);
      const behind = scanTab.acquire("background");
      await vi.advanceTimersByTimeAsync(10);
      controller.abort();
      await cancelled;
      releaseBlocker();

      const release = await behind;
      release();
    });
  });
});
