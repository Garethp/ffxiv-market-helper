import type { LockRequester } from "./webLocks";

interface PendingRequest {
  name: string;
  mode: LockMode;
  grant: () => void;
}

/**
 * An in-memory stand-in for navigator.locks, which Node doesn't provide, for
 * use in tests. Follows the Web Locks spec's granting rules: requests for a
 * name are granted strictly in order, shared locks can be held together, an
 * exclusive lock can't be held alongside anything, and aborting a request
 * that hasn't been granted yet withdraws it. Two limiters sharing one
 * instance behave like two tabs.
 */
export class InMemoryLockManager implements LockRequester {
  private readonly held: Lock[] = [];
  private readonly queues = new Map<string, PendingRequest[]>();

  request<T>(
    name: string,
    {
      mode = "exclusive",
      signal,
      ifAvailable = false,
    }: Pick<LockOptions, "mode" | "signal" | "ifAvailable">,
    callback: LockGrantedCallback<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }

      const queue = this.queueFor(name);
      // Only available if it would be granted straight away, without waiting behind anything.
      if (
        ifAvailable &&
        (queue.length > 0 || !this.isGrantable({ name, mode }))
      ) {
        Promise.resolve()
          .then(() => callback(null))
          .then((value) => resolve(value as T), reject);
        return;
      }
      const onAbort = () => {
        queue.splice(queue.indexOf(request), 1);
        reject(signal?.reason);
        this.processQueue(name);
      };
      const request: PendingRequest = {
        name,
        mode,
        grant: () => {
          signal?.removeEventListener("abort", onAbort);
          const lock: Lock = { name, mode };
          this.held.push(lock);
          Promise.resolve()
            .then(() => callback(lock))
            .then(
              (value) => {
                this.release(lock);
                resolve(value as T);
              },
              (error: unknown) => {
                this.release(lock);
                reject(error);
              },
            );
        },
      };

      signal?.addEventListener("abort", onAbort, { once: true });
      queue.push(request);
      this.processQueue(name);
    });
  }

  private queueFor(name: string): PendingRequest[] {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = [];
      this.queues.set(name, queue);
    }
    return queue;
  }

  private release(lock: Lock): void {
    this.held.splice(this.held.indexOf(lock), 1);
    this.processQueue(lock.name);
  }

  private processQueue(name: string): void {
    const queue = this.queueFor(name);
    while (queue.length > 0 && this.isGrantable(queue[0])) {
      queue.shift()!.grant();
    }
  }

  private isGrantable({
    name,
    mode,
  }: Pick<PendingRequest, "name" | "mode">): boolean {
    const holders = this.held.filter((lock) => lock.name === name);
    return mode === "exclusive"
      ? holders.length === 0
      : holders.every((lock) => lock.mode === "shared");
  }
}
