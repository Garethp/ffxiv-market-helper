/** The part of the Web Locks API this module relies on, so tests can stand in for navigator.locks. */
export interface LockRequester {
  request<T>(
    name: string,
    options: Pick<LockOptions, "mode" | "signal" | "ifAvailable">,
    callback: LockGrantedCallback<T>,
  ): Promise<T>;
}

/**
 * Takes the lock only if it can be granted straight away, resolving with a
 * function that releases it, or with nothing if it can't.
 */
export const tryHoldLock = (
  locks: LockRequester,
  name: string,
  mode: LockMode,
): Promise<(() => void) | undefined> =>
  new Promise((resolve, reject) => {
    locks
      .request(name, { mode, ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(undefined);
          return;
        }
        return new Promise<void>((release) => resolve(release));
      })
      .catch(reject);
  });

/**
 * Waits for the lock to be granted, and resolves with a function that
 * releases it. Rejects with the signal's reason if it's aborted first.
 */
export const holdLock = (
  locks: LockRequester,
  name: string,
  options: Pick<LockOptions, "mode" | "signal">,
): Promise<() => void> =>
  new Promise((resolve, reject) => {
    locks
      .request(
        name,
        options,
        () => new Promise<void>((release) => resolve(release)),
      )
      .catch(reject);
  });

/**
 * Waits for whichever of the named locks is granted first, and resolves with
 * a function that releases it. Web Locks has no "any of these" request, so
 * this queues for all of them and withdraws the rest once one is granted.
 * Rejects with the signal's reason if it's aborted first.
 */
export const holdAnyLock = (
  locks: LockRequester,
  names: string[],
  signal?: AbortSignal,
): Promise<() => void> =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();

    const race = new AbortController();
    const abortRace = () => race.abort(signal?.reason);
    signal?.addEventListener("abort", abortRace, { once: true });

    let granted = false;
    let failedCount = 0;
    for (const name of names) {
      locks
        .request(name, { signal: race.signal }, () => {
          // A second lock can be granted before the others are withdrawn — hand it straight back.
          if (granted) return;
          granted = true;
          signal?.removeEventListener("abort", abortRace);
          race.abort();
          return new Promise<void>((release) => resolve(release));
        })
        .catch((error: unknown) => {
          // Withdrawn requests reject too, which only matters if none was ever granted.
          failedCount++;
          if (failedCount === names.length) {
            signal?.removeEventListener("abort", abortRace);
            reject(error);
          }
        });
    }
  });
