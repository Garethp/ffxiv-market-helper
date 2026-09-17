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
});
