import type { ItemDetails, ItemSummary, MarketBoardItem } from "../types";
import {
  holdLock,
  tryHoldLock,
  type LockRequester,
} from "../requestLimiting/webLocks";
import type { ItemDataStore } from "./itemDataStore";

/**
 * How far keeping the item data up to date has got. Only waiting, loading and
 * failing are worth showing: checking takes a moment, and being ready is the
 * normal state of things.
 */
export type ItemDataStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "waiting" }
  | { state: "loading"; itemsSoFar: number }
  | { state: "ready" }
  | { state: "failed"; message: string };

/** Where up-to-date item data comes from. */
export interface ItemDataSource {
  fetchLatestGameVersion(): Promise<string>;
  fetchMarketBoardItems(
    version: string,
    onProgress: (itemsSoFar: number) => void,
  ): Promise<MarketBoardItem[]>;
  /** The name of every kind of thing an item can be, as of the given game version. */
  fetchItemTypeNames(version: string): Promise<Map<number, string>>;
}

/** Held exclusively while the stored items are checked or replaced, and shared while they're read, by every tab. */
const LOCK_NAME = "item-data";

/**
 * Keeps every market board item's details stored locally, refreshed whenever
 * there's a new game version. Every tab shares the one store: only one tab
 * loads at a time, and a tab that finds another already loading waits for it
 * instead of loading again. Lookups wait for any load in progress to finish,
 * so they never race one.
 */
export class ItemDataCache {
  private status: ItemDataStatus = { state: "idle" };
  private readonly listeners = new Set<() => void>();
  private loading: Promise<void> | undefined;

  constructor(
    private readonly store: ItemDataStore,
    private readonly source: ItemDataSource,
    /** Defaults to navigator.locks, looked up on first use. */
    private readonly lockRequester?: LockRequester,
  ) {}

  getStatus = (): ItemDataStatus => this.status;

  /** Calls the listener whenever the status changes, until the returned function is called. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Brings the stored items up to date with the latest game version. Only does so once, however often it's called. */
  update(): Promise<void> {
    this.loading ??= this.updateOnce();
    return this.loading;
  }

  /** The stored details of whichever of the items are stored, once any load in progress has finished. */
  getItems(
    itemIds: number[],
    options: { signal?: AbortSignal } = {},
  ): Promise<Map<number, ItemDetails>> {
    return this.readStored((store) => store.getItems(itemIds), options);
  }

  /** What whichever of the items are stored are, once any load in progress has finished. */
  getSummaries(
    itemIds: number[],
    options: { signal?: AbortSignal } = {},
  ): Promise<Map<number, ItemSummary>> {
    return this.readStored((store) => store.getSummaries(itemIds), options);
  }

  private async readStored<T>(
    read: (store: ItemDataStore) => Promise<T>,
    options: { signal?: AbortSignal },
  ): Promise<T> {
    const release = await holdLock(this.locks(), LOCK_NAME, {
      mode: "shared",
      signal: options.signal,
    });
    try {
      return await read(this.store);
    } finally {
      release();
    }
  }

  private async updateOnce(): Promise<void> {
    try {
      const release = await this.holdExclusiveLock();
      try {
        await this.bringUpToDate();
      } finally {
        release();
      }
      this.setStatus({ state: "ready" });
    } catch (error) {
      this.setStatus({
        state: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async holdExclusiveLock(): Promise<() => void> {
    const locks = this.locks();
    const release = await tryHoldLock(locks, LOCK_NAME, "exclusive");
    if (release) return release;
    // Another tab is checking or loading; once it's done, there'll be nothing left to load.
    this.setStatus({ state: "waiting" });
    return holdLock(locks, LOCK_NAME, { mode: "exclusive" });
  }

  private async bringUpToDate(): Promise<void> {
    this.setStatus({ state: "checking" });
    const storedVersion = await this.store.getVersion();
    const latestVersion = await this.source
      .fetchLatestGameVersion()
      .catch((error: unknown) => {
        // Items already stored are still worth using when there's no telling whether they're current.
        if (storedVersion !== undefined) return storedVersion;
        throw error;
      });
    if (storedVersion === latestVersion) return;

    this.setStatus({ state: "loading", itemsSoFar: 0 });
    const [items, typeNames] = await Promise.all([
      this.source.fetchMarketBoardItems(latestVersion, (itemsSoFar) =>
        this.setStatus({ state: "loading", itemsSoFar }),
      ),
      this.source.fetchItemTypeNames(latestVersion),
    ]);
    await this.store.replaceItems(latestVersion, items, typeNames);
  }

  private setStatus(status: ItemDataStatus): void {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }

  private locks(): LockRequester {
    return this.lockRequester ?? navigator.locks;
  }
}
