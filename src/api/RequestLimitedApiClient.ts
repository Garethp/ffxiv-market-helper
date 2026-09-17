import type { Fetcher } from "./Fetcher";
import type {
  RequestLimiter,
  RequestPriority,
} from "../requestLimiting/RequestLimiter";

/**
 * Wraps fetch so every request first waits for a permit from a
 * RequestLimiter, at this client's priority, so callers get rate limiting for
 * free instead of managing it themselves. Several clients can share one
 * limiter to draw from the same budget.
 */
export class RequestLimitedApiClient implements Fetcher {
  constructor(
    private readonly limiter: RequestLimiter,
    private readonly priority: RequestPriority,
  ) {}

  async fetch(input: string, init?: RequestInit): Promise<Response> {
    const release = await this.limiter.acquire(this.priority);
    try {
      return await fetch(input, init);
    } finally {
      release();
    }
  }
}
