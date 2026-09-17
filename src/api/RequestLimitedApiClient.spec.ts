import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestLimitedApiClient } from "./RequestLimitedApiClient";
import { CrossTabRequestLimiter } from "../requestLimiting/CrossTabRequestLimiter";
import { InMemoryLockManager } from "../requestLimiting/InMemoryLockManager";
import type { RequestLimits } from "../requestLimiting/RequestLimiter";

afterEach(() => {
  vi.unstubAllGlobals();
});

const createLimiter = (limits: RequestLimits) =>
  new CrossTabRequestLimiter("test-api", limits, new InMemoryLockManager());

describe("RequestLimitedApiClient", () => {
  it("should hold requests back until the limiter has room for them", async () => {
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 30));
        active--;
        return new Response("{}");
      }),
    );

    const client = new RequestLimitedApiClient(
      createLimiter({ maxConcurrent: 3, maxRequestsPerSecond: 100 }),
      "interactive",
    );
    await Promise.all(
      Array.from({ length: 12 }, () => client.fetch("https://example.test")),
    );

    expect(maxActive).toBe(3);
  });

  it("should free its slot when a request fails, so later requests still go out", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("network down"))
        .mockResolvedValue(new Response("{}")),
    );

    const client = new RequestLimitedApiClient(
      createLimiter({ maxConcurrent: 1, maxRequestsPerSecond: 100 }),
      "interactive",
    );

    await expect(client.fetch("https://example.test")).rejects.toThrow(
      "network down",
    );
    await expect(client.fetch("https://example.test")).resolves.toBeInstanceOf(
      Response,
    );
  });

  it("should drop a cancelled request that's still waiting for a slot, without ever sending it", async () => {
    let releaseBlockingRequest!: () => void;
    const fetchedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetchedUrls.push(url);
        if (url === "https://example.test/blocking") {
          await new Promise<void>(
            (resolve) => (releaseBlockingRequest = resolve),
          );
        }
        return new Response("{}");
      }),
    );

    const client = new RequestLimitedApiClient(
      createLimiter({ maxConcurrent: 1, maxRequestsPerSecond: 100 }),
      "background",
    );
    const blocking = client.fetch("https://example.test/blocking");
    await new Promise((resolve) => setTimeout(resolve, 5));

    const controller = new AbortController();
    const cancelled = client.fetch("https://example.test/cancelled", {
      signal: controller.signal,
    });
    const next = client.fetch("https://example.test/next");
    controller.abort(new Error("abandoned"));

    await expect(cancelled).rejects.toThrow("abandoned");
    releaseBlockingRequest();
    await Promise.all([blocking, next]);
    expect(fetchedUrls).toEqual([
      "https://example.test/blocking",
      "https://example.test/next",
    ]);
  });

  it("should still count a request cancelled mid-flight against the rate limit, since it may already have reached the server", async () => {
    const starts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        starts.push(Date.now());
        const signal = init?.signal;
        if (signal) {
          await new Promise((_, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason)),
          );
        }
        return new Response("{}");
      }),
    );

    const client = new RequestLimitedApiClient(
      createLimiter({ maxConcurrent: 10, maxRequestsPerSecond: 1 }),
      "interactive",
    );
    const controller = new AbortController();
    const cancelled = client
      .fetch("https://example.test/cancelled", { signal: controller.signal })
      .catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    await cancelled;

    await client.fetch("https://example.test/next");

    expect(starts).toHaveLength(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(990);
  });
});
