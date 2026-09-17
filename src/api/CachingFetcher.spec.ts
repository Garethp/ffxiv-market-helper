import { describe, expect, it } from "vitest";
import { CachingFetcher } from "./CachingFetcher";
import type { Fetcher } from "./Fetcher";

describe("CachingFetcher", () => {
  it("should reuse a cached response for an identical request made again within the TTL", async () => {
    let callCount = 0;
    const inner: Fetcher = {
      fetch: async () => {
        callCount++;
        return new Response(JSON.stringify({ callCount }));
      },
    };
    const cache = new CachingFetcher(inner, { ttlMs: 1000 });

    const first = await (await cache.fetch("https://example.test/a")).json();
    const second = await (await cache.fetch("https://example.test/a")).json();

    expect(callCount).toBe(1);
    expect(first).toEqual(second);
  });

  it("should coalesce concurrent identical requests into a single network request", async () => {
    let callCount = 0;
    const inner: Fetcher = {
      fetch: async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response("{}");
      },
    };
    const cache = new CachingFetcher(inner, { ttlMs: 1000 });

    await Promise.all([
      cache.fetch("https://example.test/a"),
      cache.fetch("https://example.test/a"),
      cache.fetch("https://example.test/a"),
    ]);

    expect(callCount).toBe(1);
  });

  it("should fetch again once the cached response has expired", async () => {
    let callCount = 0;
    const inner: Fetcher = {
      fetch: async () => {
        callCount++;
        return new Response("{}");
      },
    };
    const cache = new CachingFetcher(inner, { ttlMs: 10 });

    await cache.fetch("https://example.test/a");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await cache.fetch("https://example.test/a");

    expect(callCount).toBe(2);
  });

  it("should not cache a failed request, so a retry goes out fresh", async () => {
    let callCount = 0;
    const inner: Fetcher = {
      fetch: async () => {
        callCount++;
        if (callCount === 1) throw new Error("network error");
        return new Response("{}");
      },
    };
    const cache = new CachingFetcher(inner, { ttlMs: 1000 });

    await expect(cache.fetch("https://example.test/a")).rejects.toThrow();
    await expect(cache.fetch("https://example.test/a")).resolves.toBeInstanceOf(
      Response,
    );

    expect(callCount).toBe(2);
  });

  it("should not cache a response with a failed HTTP status, so a retry can succeed once the server recovers", async () => {
    let callCount = 0;
    const inner: Fetcher = {
      fetch: async () => {
        callCount++;
        return callCount === 1
          ? new Response("server error", { status: 500 })
          : new Response("{}", { status: 200 });
      },
    };
    const cache = new CachingFetcher(inner, { ttlMs: 1000 });

    const first = await cache.fetch("https://example.test/a");
    const second = await cache.fetch("https://example.test/a");

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(callCount).toBe(2);
  });

  it("should let each caller read the cached response independently", async () => {
    const inner: Fetcher = {
      fetch: async () => new Response(JSON.stringify({ value: 42 })),
    };
    const cache = new CachingFetcher(inner, { ttlMs: 1000 });

    const [a, b] = await Promise.all([
      cache.fetch("https://example.test/a"),
      cache.fetch("https://example.test/a"),
    ]);

    await expect(a.json()).resolves.toEqual({ value: 42 });
    await expect(b.json()).resolves.toEqual({ value: 42 });
  });

  it("should keep a shared request going for other callers when one caller cancels", async () => {
    const inner: Fetcher = {
      fetch: async (_input, init) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        init?.signal?.throwIfAborted();
        return new Response("{}");
      },
    };
    const cache = new CachingFetcher(inner, { ttlMs: 1000 });

    const controller = new AbortController();
    const cancelling = cache.fetch("https://example.test/a", {
      signal: controller.signal,
    });
    const other = cache.fetch("https://example.test/a");
    controller.abort();

    await expect(cancelling).resolves.toBeInstanceOf(Response);
    await expect(other).resolves.toBeInstanceOf(Response);
  });
});
