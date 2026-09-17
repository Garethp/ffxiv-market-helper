import type { Fetcher } from "./Fetcher";

export interface CachingFetcherOptions {
  /** How long a successful response is reused for an identical request before being re-fetched. */
  ttlMs: number;
}

interface CacheEntry {
  expiresAt: number;
  response: Promise<Response>;
}

/**
 * Wraps another Fetcher and caches successful responses briefly, so
 * identical concurrent or near-concurrent requests (e.g. from independent
 * callers that happen to want the same data) don't each hit the network.
 * A failed request is never cached — it's evicted immediately so a retry
 * always goes out fresh.
 */
export class CachingFetcher implements Fetcher {
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly inner: Fetcher,
    { ttlMs }: CachingFetcherOptions,
  ) {
    this.ttlMs = ttlMs;
  }

  async fetch(input: string, init?: RequestInit): Promise<Response> {
    const cached = this.cache.get(input);
    if (cached && cached.expiresAt > Date.now()) {
      return (await cached.response).clone();
    }

    const responsePromise = this.inner.fetch(input, init);
    const entry: CacheEntry = {
      expiresAt: Date.now() + this.ttlMs,
      response: responsePromise,
    };
    this.cache.set(input, entry);
    responsePromise.then(
      (response) => {
        if (!response.ok && this.cache.get(input) === entry) {
          this.cache.delete(input);
        }
      },
      () => {
        if (this.cache.get(input) === entry) this.cache.delete(input);
      },
    );

    return (await responsePromise).clone();
  }
}
