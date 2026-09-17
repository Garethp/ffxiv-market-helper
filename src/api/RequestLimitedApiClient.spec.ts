import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestLimitedApiClient } from "./RequestLimitedApiClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RequestLimitedApiClient", () => {
  it("should never allow more requests in flight at once than the configured concurrency limit", async () => {
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

    const client = new RequestLimitedApiClient({
      maxConcurrent: 3,
      maxRequestsPerSecond: 100,
    });
    await Promise.all(
      Array.from({ length: 12 }, () => client.fetch("https://example.test")),
    );

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("should never start more requests than the configured rate within any one-second window", async () => {
    const starts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        starts.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 15));
        return new Response("{}");
      }),
    );

    const client = new RequestLimitedApiClient({
      maxConcurrent: 50,
      maxRequestsPerSecond: 10,
    });
    await Promise.all(
      Array.from({ length: 12 }, () => client.fetch("https://example.test")),
    );

    const worstWindowCount = starts.reduce((worst, windowStart) => {
      const count = starts.filter(
        (t) => t >= windowStart && t < windowStart + 1000,
      ).length;
      return Math.max(worst, count);
    }, 0);

    expect(worstWindowCount).toBeLessThanOrEqual(10);
  });

  it("should start requests together in a burst when both concurrency and rate have room", async () => {
    const starts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        starts.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new Response("{}");
      }),
    );

    const client = new RequestLimitedApiClient({
      maxConcurrent: 5,
      maxRequestsPerSecond: 20,
    });
    await Promise.all(
      Array.from({ length: 5 }, () => client.fetch("https://example.test")),
    );

    const spread = Math.max(...starts) - Math.min(...starts);
    expect(spread).toBeLessThan(15);
  });

  it("should stop starting new requests once paused, letting in-flight ones finish", async () => {
    let started = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        started++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return new Response("{}");
      }),
    );

    const client = new RequestLimitedApiClient({
      maxConcurrent: 2,
      maxRequestsPerSecond: 100,
    });

    const inFlight = Array.from({ length: 2 }, () =>
      client.fetch("https://example.test"),
    );
    // Give the first two requests a chance to actually start before pausing.
    await new Promise((resolve) => setTimeout(resolve, 5));
    client.pause();

    const queuedAfterPause = client.fetch("https://example.test");
    await Promise.all(inFlight);

    // The two in-flight requests started and finished; the one queued after pause never got the chance to.
    expect(started).toBe(2);

    client.resume();
    await queuedAfterPause;
    expect(started).toBe(3);
  });

  it("should keep processing already-queued requests after resuming", async () => {
    const starts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        starts.push(Date.now());
        return new Response("{}");
      }),
    );

    const client = new RequestLimitedApiClient({
      maxConcurrent: 5,
      maxRequestsPerSecond: 100,
    });

    client.pause();
    const requests = Array.from({ length: 5 }, () =>
      client.fetch("https://example.test"),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(starts).toHaveLength(0);

    client.resume();
    await Promise.all(requests);
    expect(starts).toHaveLength(5);
  });
});
