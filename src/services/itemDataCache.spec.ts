import { describe, expect, it, vi } from "vitest";
import { InMemoryLockManager } from "../requestLimiting/InMemoryLockManager";
import { MemoryItemDataStore } from "../testing/MemoryItemDataStore";
import type { MarketBoardItem } from "../types";
import {
  ItemDataCache,
  type ItemDataSource,
  type ItemDataStatus,
} from "./itemDataCache";

/** A promise whose resolution is controlled from outside. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const cordial = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
  description: "A sweet, fermented concoction.",
  typeId: 44,
};

const typeNames = new Map([[44, "Medicine"]]);

const sourceOf = (
  latestVersion: string,
  items: MarketBoardItem[] = [cordial],
) => ({
  fetchLatestGameVersion: vi.fn<ItemDataSource["fetchLatestGameVersion"]>(
    async () => latestVersion,
  ),
  fetchMarketBoardItems: vi.fn<ItemDataSource["fetchMarketBoardItems"]>(
    async () => items,
  ),
  fetchItemTypeNames: vi.fn<ItemDataSource["fetchItemTypeNames"]>(
    async () => typeNames,
  ),
});

const setUp = ({
  store = new MemoryItemDataStore(),
  source = sourceOf("7.56x1"),
  locks = new InMemoryLockManager(),
} = {}) => {
  const cache = new ItemDataCache(store, source, locks);
  const statuses: ItemDataStatus[] = [];
  cache.subscribe(() => statuses.push(cache.getStatus()));
  return { cache, store, source, locks, statuses };
};

describe("ItemDataCache", () => {
  describe("bringing the stored items up to date", () => {
    it("should load every market board item, as of the latest version, when nothing's stored", async () => {
      const { cache, store, source } = setUp();

      await cache.update();

      expect(source.fetchMarketBoardItems).toHaveBeenCalledWith(
        "7.56x1",
        expect.any(Function),
      );
      expect(store.version).toBe("7.56x1");
      expect(await cache.getItems([6141])).toEqual(
        new Map([[6141, { name: "Cordial", stackSize: 999 }]]),
      );
      expect(cache.getStatus()).toEqual({ state: "ready" });
    });

    it("should load nothing when the stored items are from the latest version", async () => {
      const store = new MemoryItemDataStore();
      await store.replaceItems("7.56x1", [cordial], typeNames);
      const { cache, source } = setUp({ store });

      await cache.update();

      expect(source.fetchMarketBoardItems).not.toHaveBeenCalled();
      expect(cache.getStatus()).toEqual({ state: "ready" });
    });

    it("should replace stored items from an older version", async () => {
      const store = new MemoryItemDataStore();
      await store.replaceItems(
        "7.55",
        [{ ...cordial, name: "Old name" }],
        typeNames,
      );
      const { cache } = setUp({ store });

      await cache.update();

      expect(store.version).toBe("7.56x1");
      expect((await cache.getItems([6141])).get(6141)?.name).toBe("Cordial");
    });

    it("should report checking, then how many items have loaded so far, then being ready", async () => {
      const source = sourceOf("7.56x1");
      source.fetchMarketBoardItems.mockImplementation(async (_, onProgress) => {
        onProgress(500);
        onProgress(900);
        return [cordial];
      });
      const { cache, statuses } = setUp({ source });

      await cache.update();

      expect(statuses).toEqual([
        { state: "checking" },
        { state: "loading", itemsSoFar: 0 },
        { state: "loading", itemsSoFar: 500 },
        { state: "loading", itemsSoFar: 900 },
        { state: "ready" },
      ]);
    });

    it("should only bring the items up to date once, however often it's asked to", async () => {
      const { cache, source } = setUp();

      await Promise.all([cache.update(), cache.update()]);
      await cache.update();

      expect(source.fetchLatestGameVersion).toHaveBeenCalledTimes(1);
    });
  });

  describe("when loading goes wrong", () => {
    it("should keep using the stored items when the latest version can't be found out", async () => {
      const store = new MemoryItemDataStore();
      await store.replaceItems("7.55", [cordial], typeNames);
      const source = sourceOf("7.56x1");
      source.fetchLatestGameVersion.mockRejectedValue(
        new Error("XIVAPI is down"),
      );
      const { cache } = setUp({ store, source });

      await cache.update();

      expect(source.fetchMarketBoardItems).not.toHaveBeenCalled();
      expect(cache.getStatus()).toEqual({ state: "ready" });
      expect((await cache.getItems([6141])).get(6141)?.name).toBe("Cordial");
    });

    it("should say why it failed when nothing's stored and the latest version can't be found out", async () => {
      const source = sourceOf("7.56x1");
      source.fetchLatestGameVersion.mockRejectedValue(
        new Error("XIVAPI is down"),
      );
      const { cache } = setUp({ source });

      await cache.update();

      expect(cache.getStatus()).toEqual({
        state: "failed",
        message: "XIVAPI is down",
      });
    });

    it("should say why it failed, and leave the stored items alone, when the items can't be loaded", async () => {
      const store = new MemoryItemDataStore();
      await store.replaceItems("7.55", [cordial], typeNames);
      const source = sourceOf("7.56x1");
      source.fetchMarketBoardItems.mockRejectedValue(
        new Error("XIVAPI market board item search failed (500)"),
      );
      const { cache } = setUp({ store, source });

      await cache.update();

      expect(cache.getStatus()).toEqual({
        state: "failed",
        message: "XIVAPI market board item search failed (500)",
      });
      expect(store.version).toBe("7.55");
    });

    it("should still let items be looked up after failing", async () => {
      const source = sourceOf("7.56x1");
      source.fetchMarketBoardItems.mockRejectedValue(new Error("Down"));
      const { cache } = setUp({ source });

      await cache.update();

      expect(await cache.getItems([6141])).toEqual(new Map());
    });
  });

  describe("across tabs", () => {
    it("should wait for another tab that's already loading, then load nothing itself", async () => {
      const store = new MemoryItemDataStore();
      const locks = new InMemoryLockManager();
      const loading = deferred<MarketBoardItem[]>();
      const firstSource = sourceOf("7.56x1");
      firstSource.fetchMarketBoardItems.mockReturnValue(loading.promise);
      const firstTab = setUp({ store, locks, source: firstSource });
      const secondTab = setUp({ store, locks });

      const firstUpdate = firstTab.cache.update();
      await vi.waitFor(() =>
        expect(firstSource.fetchMarketBoardItems).toHaveBeenCalled(),
      );
      const secondUpdate = secondTab.cache.update();
      await vi.waitFor(() =>
        expect(secondTab.cache.getStatus()).toEqual({ state: "waiting" }),
      );

      loading.resolve([cordial]);
      await Promise.all([firstUpdate, secondUpdate]);

      expect(secondTab.source.fetchMarketBoardItems).not.toHaveBeenCalled();
      expect(secondTab.cache.getStatus()).toEqual({ state: "ready" });
    });

    it("should not say it's waiting when no other tab is loading", async () => {
      const { cache, statuses } = setUp();

      await cache.update();

      expect(statuses).not.toContainEqual({ state: "waiting" });
    });
  });

  describe("looking up items", () => {
    it("should wait for a load in progress to finish, rather than reading what's there before it", async () => {
      const loading = deferred<MarketBoardItem[]>();
      const source = sourceOf("7.56x1");
      source.fetchMarketBoardItems.mockReturnValue(loading.promise);
      const { cache } = setUp({ source });

      const update = cache.update();
      await vi.waitFor(() =>
        expect(source.fetchMarketBoardItems).toHaveBeenCalled(),
      );
      const lookup = cache.getItems([6141]);
      loading.resolve([cordial]);

      expect((await lookup).get(6141)?.name).toBe("Cordial");
      await update;
    });

    it("should wait for a load in another tab to finish too", async () => {
      const store = new MemoryItemDataStore();
      const locks = new InMemoryLockManager();
      const loading = deferred<MarketBoardItem[]>();
      const source = sourceOf("7.56x1");
      source.fetchMarketBoardItems.mockReturnValue(loading.promise);
      const loadingTab = setUp({ store, locks, source });
      const otherTab = setUp({ store, locks });

      const update = loadingTab.cache.update();
      await vi.waitFor(() =>
        expect(source.fetchMarketBoardItems).toHaveBeenCalled(),
      );
      const lookup = otherTab.cache.getItems([6141]);
      loading.resolve([cordial]);

      expect((await lookup).get(6141)?.name).toBe("Cordial");
      await update;
    });

    it("should let a lookup that's waiting be cancelled", async () => {
      const loading = deferred<MarketBoardItem[]>();
      const source = sourceOf("7.56x1");
      source.fetchMarketBoardItems.mockReturnValue(loading.promise);
      const { cache } = setUp({ source });
      const update = cache.update();
      await vi.waitFor(() =>
        expect(source.fetchMarketBoardItems).toHaveBeenCalled(),
      );
      const controller = new AbortController();

      const lookup = cache.getItems([6141], { signal: controller.signal });
      controller.abort(new Error("Cancelled"));

      await expect(lookup).rejects.toThrow("Cancelled");
      loading.resolve([cordial]);
      await update;
    });
  });

  describe("its status", () => {
    it("should stop telling a listener about changes once it's unsubscribed", async () => {
      const { cache } = setUp();
      const listener = vi.fn();
      const unsubscribe = cache.subscribe(listener);

      unsubscribe();
      await cache.update();

      expect(listener).not.toHaveBeenCalled();
    });

    it("should start out idle", () => {
      expect(setUp().cache.getStatus()).toEqual({ state: "idle" });
    });
  });
});
