import type { Fetcher } from "./Fetcher";

export interface RequestLimitedApiClientOptions {
  /** Maximum number of requests allowed to be in flight at the same time. */
  maxConcurrent: number;
  /** Maximum number of requests allowed to start within any rolling 1-second window. */
  maxRequestsPerSecond: number;
}

/** A conservative shared default for being a polite citizen of the external APIs this app calls. */
export const DEFAULT_RATE_LIMIT: RequestLimitedApiClientOptions = {
  maxConcurrent: 3,
  maxRequestsPerSecond: 10,
};

const WINDOW_MS = 1000;

/**
 * Wraps fetch with a request queue that caps how many requests are in
 * flight at once and how many are allowed to start within any rolling
 * 1-second window, so callers get rate limiting for free instead of
 * managing it themselves. The two limits are independent: as long as both
 * have room, requests start together in a burst rather than being spaced
 * out one-by-one — e.g. maxConcurrent: 8 really does let 8 requests fire at
 * once, provided maxRequestsPerSecond allows it too.
 */
export class RequestLimitedApiClient implements Fetcher {
  private readonly maxConcurrent: number;
  private readonly maxRequestsPerSecond: number;
  private activeCount = 0;
  /** Start timestamps within the current rolling window, oldest first. */
  private readonly recentStarts: number[] = [];
  private readonly queue: Array<() => void> = [];
  private rateLimitRetryPending = false;
  private paused = false;

  constructor({
    maxConcurrent,
    maxRequestsPerSecond,
  }: RequestLimitedApiClientOptions) {
    this.maxConcurrent = maxConcurrent;
    this.maxRequestsPerSecond = maxRequestsPerSecond;
  }

  async fetch(input: string, init?: RequestInit): Promise<Response> {
    await this.acquireSlot();
    try {
      return await fetch(input, init);
    } finally {
      this.activeCount--;
      this.drainQueue();
    }
  }

  private acquireSlot(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.drainQueue();
    });
  }

  /** Stops starting new requests. Ones already in flight run to completion — this only holds back the queue. */
  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.drainQueue();
  }

  private pruneExpiredStarts(now: number): void {
    while (
      this.recentStarts.length > 0 &&
      now - this.recentStarts[0] >= WINDOW_MS
    ) {
      this.recentStarts.shift();
    }
  }

  private drainQueue(): void {
    if (this.paused) return;

    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const now = Date.now();
      this.pruneExpiredStarts(now);

      if (this.recentStarts.length >= this.maxRequestsPerSecond) {
        this.scheduleRateLimitRetry();
        return;
      }

      const startNext = this.queue.shift()!;
      this.activeCount++;
      this.recentStarts.push(now);
      startNext();
    }
  }

  /** At most one retry timer is ever pending, no matter how many callers are queued behind the rate limit. */
  private scheduleRateLimitRetry(): void {
    if (this.rateLimitRetryPending) return;
    this.rateLimitRetryPending = true;

    const oldestStart = this.recentStarts[0];
    const retryInMs = Math.max(0, WINDOW_MS - (Date.now() - oldestStart)) + 1;
    setTimeout(() => {
      this.rateLimitRetryPending = false;
      this.drainQueue();
    }, retryInMs);
  }
}
