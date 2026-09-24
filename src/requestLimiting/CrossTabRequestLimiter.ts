import type {
  ReleasePermit,
  RequestLimiter,
  RequestLimits,
  RequestPriority,
} from "./RequestLimiter";
import { holdAnyLock, holdLock, type LockRequester } from "./webLocks";

const RATE_WINDOW_MS = 1000;

/**
 * A RequestLimiter whose budget is shared across every open tab of the app:
 * all limiters with the same name, in any tab, draw from the same limits.
 * Built on Web Locks, so a tab that closes or crashes gives back whatever it
 * was holding.
 *
 * Both limits are pools of locks. A request holds a concurrency lock while
 * it's in flight, and a rate lock for one second from when it starts, so no
 * more than maxRequestsPerSecond requests can start in any rolling second.
 *
 * Priority uses one more lock as a gate. Interactive requests hold it in
 * shared mode while they wait for a permit. Background requests must pass
 * through it in exclusive mode before they start waiting, which they can't do
 * while any interactive request is waiting. So background requests use every
 * slot while nothing interactive wants one, and otherwise let interactive
 * requests go first, except for a background request that was already
 * waiting for a slot when the interactive one arrived.
 */
export class CrossTabRequestLimiter implements RequestLimiter {
  private readonly concurrencyLockNames: string[];
  private readonly rateLockNames: string[];
  private readonly priorityGateLockName: string;
  /**
   * The most recent acquisition started in this tab for each priority.
   * Acquisitions of the same priority run one at a time, so a tab never has
   * more than one request per priority queued on the slot locks. That keeps
   * lock queues short, and means at most one background request per tab can
   * be ahead of an interactive request that arrives after it.
   */
  private readonly latestAcquisition: Record<
    RequestPriority,
    Promise<unknown>
  > = {
    interactive: Promise.resolve(),
    background: Promise.resolve(),
  };

  constructor(
    name: string,
    { maxConcurrent, maxRequestsPerSecond }: RequestLimits,
    /** Defaults to navigator.locks, looked up on first use. */
    private readonly lockRequester?: LockRequester,
  ) {
    const prefix = `request-limiter:${name}`;
    this.concurrencyLockNames = Array.from(
      { length: maxConcurrent },
      (_, i) => `${prefix}:concurrency:${i}`,
    );
    this.rateLockNames = Array.from(
      { length: maxRequestsPerSecond },
      (_, i) => `${prefix}:rate:${i}`,
    );
    this.priorityGateLockName = `${prefix}:priority-gate`;
  }

  async acquire(
    priority: RequestPriority,
    signal?: AbortSignal,
  ): Promise<ReleasePermit> {
    const locks = this.getLocks();

    if (priority === "background") {
      return this.oneAtATime("background", async () => {
        await locks.request(
          this.priorityGateLockName,
          { mode: "exclusive", signal },
          () => {},
        );
        return this.acquireSlots(locks, signal);
      });
    }

    const releaseGate = await holdLock(locks, this.priorityGateLockName, {
      mode: "shared",
      signal,
    });
    try {
      return await this.oneAtATime("interactive", () =>
        this.acquireSlots(locks, signal),
      );
    } finally {
      releaseGate();
    }
  }

  private getLocks(): LockRequester {
    const locks = this.lockRequester ?? navigator.locks;
    if (!locks) {
      throw new Error(
        "Web Locks are unavailable. The app must be served from a secure context (HTTPS or localhost).",
      );
    }
    return locks;
  }

  private oneAtATime<T>(
    priority: RequestPriority,
    acquisition: () => Promise<T>,
  ): Promise<T> {
    const result = this.latestAcquisition[priority].then(acquisition);
    this.latestAcquisition[priority] = result.catch(() => undefined);
    return result;
  }

  private async acquireSlots(
    locks: LockRequester,
    signal?: AbortSignal,
  ): Promise<ReleasePermit> {
    const releaseConcurrency = await holdAnyLock(
      locks,
      this.concurrencyLockNames,
      signal,
    );

    let releaseRate: () => void;
    try {
      releaseRate = await holdAnyLock(locks, this.rateLockNames, signal);
    } catch (error) {
      releaseConcurrency();
      throw error;
    }

    // The last lock can be granted in the same moment the signal aborts. No request will start, so give both back.
    if (signal?.aborted) {
      releaseRate();
      releaseConcurrency();
      throw signal.reason;
    }

    // Held for the full window even if the request is cancelled after this, since it may already
    // have reached the server and counted against its limit.
    setTimeout(releaseRate, RATE_WINDOW_MS);
    return releaseConcurrency;
  }
}
