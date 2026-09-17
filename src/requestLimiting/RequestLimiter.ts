/** Which requests go first when several are waiting on the same budget. */
export type RequestPriority = "interactive" | "background";

export interface RequestLimits {
  /** Maximum number of requests allowed to be in flight at the same time. */
  maxConcurrent: number;
  /** Maximum number of requests allowed to start within any rolling 1-second window. */
  maxRequestsPerSecond: number;
}

/** Frees the concurrency slot a permit holds. Call it once the request has finished. */
export type ReleasePermit = () => void;

/** Hands out permission to start requests against a budget of RequestLimits. */
export interface RequestLimiter {
  /**
   * Waits until a request of the given priority may start, and resolves with
   * the function to call once it has finished. Rejects with the signal's
   * reason if it's aborted before a permit is granted, without using up any
   * of the budget.
   */
  acquire(
    priority: RequestPriority,
    signal?: AbortSignal,
  ): Promise<ReleasePermit>;
}
