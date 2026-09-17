import type {
  RequestLimiter,
  RequestPriority,
} from "../requestLimiting/RequestLimiter";

/**
 * Wraps fetch so every request first waits for a permit from a
 * RequestLimiter, at this client's priority, so callers get rate limiting for
 * free instead of managing it themselves. Several clients can share one
 * limiter to draw from the same budget. Aborting `init.signal` cancels a
 * request whether it's still waiting for a permit or already in flight.
 */
export class RequestLimitedApiClient {
  constructor(
    private readonly limiter: RequestLimiter,
    private readonly priority: RequestPriority,
  ) {}

  async fetch(input: string, init?: RequestInit): Promise<Response> {
    const release = await this.limiter.acquire(
      this.priority,
      init?.signal ?? undefined,
    );
    try {
      return await fetch(input, init);
    } finally {
      release();
    }
  }
}
