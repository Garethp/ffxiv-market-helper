/** The part of the Web Locks API this module relies on, so tests can stand in for navigator.locks. */
export interface LockRequester {
  request<T>(
    name: string,
    options: Pick<LockOptions, "mode" | "signal">,
    callback: LockGrantedCallback<T>,
  ): Promise<T>;
}

/** Waits for the lock to be granted, and resolves with a function that releases it. */
export const holdLock = (
  locks: LockRequester,
  name: string,
  mode: LockMode,
): Promise<() => void> =>
  new Promise((resolve, reject) => {
    locks
      .request(
        name,
        { mode },
        () => new Promise<void>((release) => resolve(release)),
      )
      .catch(reject);
  });

/**
 * Waits for whichever of the named locks is granted first, and resolves with
 * a function that releases it. Web Locks has no "any of these" request, so
 * this queues for all of them and withdraws the rest once one is granted.
 */
export const holdAnyLock = (
  locks: LockRequester,
  names: string[],
): Promise<() => void> =>
  new Promise((resolve, reject) => {
    const race = new AbortController();
    let granted = false;
    let failedCount = 0;

    for (const name of names) {
      locks
        .request(name, { signal: race.signal }, () => {
          // A second lock can be granted before the others are withdrawn — hand it straight back.
          if (granted) return;
          granted = true;
          race.abort();
          return new Promise<void>((release) => resolve(release));
        })
        .catch((error: unknown) => {
          // Withdrawn requests reject too, which only matters if none was ever granted.
          failedCount++;
          if (failedCount === names.length) reject(error);
        });
    }
  });
