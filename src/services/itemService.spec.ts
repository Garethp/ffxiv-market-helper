import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/xivapi", () => ({
  fetchExpertDeliveryCandidates: vi.fn(),
  fetchExpertDeliverySealsByItemLevel: vi.fn(),
  fetchItem: vi.fn(),
  fetchItemNames: vi.fn(),
  fetchLatestGameVersion: vi.fn(),
  fetchMarketBoardItems: vi.fn(),
  searchItems: vi.fn(),
}));

import {
  fetchExpertDeliveryCandidates,
  fetchExpertDeliverySealsByItemLevel,
  fetchItem,
  fetchItemNames,
  searchItems,
} from "../api/xivapi";
import { InMemoryLockManager } from "../requestLimiting/InMemoryLockManager";
import { MemoryItemDataStore } from "../testing/MemoryItemDataStore";
import type { ItemSearchResult } from "../types";
import { ItemDataCache } from "./itemDataCache";
import { CachingItemService } from "./itemService";

const mockedFetchCandidates = vi.mocked(fetchExpertDeliveryCandidates);
const mockedFetchSeals = vi.mocked(fetchExpertDeliverySealsByItemLevel);
const mockedFetchItem = vi.mocked(fetchItem);
const mockedFetchItemNames = vi.mocked(fetchItemNames);
const mockedSearchItems = vi.mocked(searchItems);

const cordial = { itemId: 6141, name: "Cordial", stackSize: 999 };

/** An item service whose cache holds the given market board items, already loaded. */
const serviceCaching = async (items: ItemSearchResult[] = [cordial]) => {
  const store = new MemoryItemDataStore();
  const cache = new ItemDataCache(
    store,
    {
      fetchLatestGameVersion: async () => "7.56x1",
      fetchMarketBoardItems: async () => items,
    },
    new InMemoryLockManager(),
  );
  const service = new CachingItemService(cache);
  await service.prepareItemData();
  return { service, store };
};

afterEach(() => {
  vi.resetAllMocks();
});

describe("CachingItemService", () => {
  describe("item names", () => {
    it("should give cached names without asking XIVAPI", async () => {
      const { service } = await serviceCaching();

      expect(await service.getItemNames([6141])).toEqual(
        new Map([[6141, "Cordial"]]),
      );
      expect(mockedFetchItemNames).not.toHaveBeenCalled();
    });

    it("should ask XIVAPI for only the names that aren't cached", async () => {
      const { service } = await serviceCaching();
      mockedFetchItemNames.mockResolvedValue(new Map([[1, "Uncached"]]));

      expect(await service.getItemNames([6141, 1])).toEqual(
        new Map([
          [6141, "Cordial"],
          [1, "Uncached"],
        ]),
      );
      expect(mockedFetchItemNames).toHaveBeenCalledWith([1]);
    });

    it("should ask XIVAPI for every name when the cache can't be read", async () => {
      const { service, store } = await serviceCaching();
      vi.spyOn(store, "getItems").mockRejectedValue(new Error("Unreadable"));
      mockedFetchItemNames.mockResolvedValue(new Map([[6141, "Cordial"]]));

      expect(await service.getItemNames([6141])).toEqual(
        new Map([[6141, "Cordial"]]),
      );
      expect(mockedFetchItemNames).toHaveBeenCalledWith([6141]);
    });
  });

  describe("an item's details", () => {
    it("should give a cached item's details without asking XIVAPI", async () => {
      const { service } = await serviceCaching();

      expect(await service.getItem(6141)).toEqual({
        name: "Cordial",
        stackSize: 999,
      });
      expect(mockedFetchItem).not.toHaveBeenCalled();
    });

    it("should ask XIVAPI for an item that isn't cached, letting the request be cancelled", async () => {
      const { service } = await serviceCaching();
      mockedFetchItem.mockResolvedValue({ name: "Uncached", stackSize: 1 });
      const { signal } = new AbortController();

      expect(await service.getItem(1, { signal })).toEqual({
        name: "Uncached",
        stackSize: 1,
      });
      expect(mockedFetchItem).toHaveBeenCalledWith(1, { signal });
    });

    it("should ask XIVAPI when the cache can't be read", async () => {
      const { service, store } = await serviceCaching();
      vi.spyOn(store, "getItems").mockRejectedValue(new Error("Unreadable"));
      mockedFetchItem.mockResolvedValue({ name: "Cordial", stackSize: 999 });

      expect(await service.getItem(6141)).toEqual({
        name: "Cordial",
        stackSize: 999,
      });
    });

    it("should give up, rather than ask XIVAPI, when cancelled while waiting for the cache", async () => {
      const store = new MemoryItemDataStore();
      const service = new CachingItemService(
        new ItemDataCache(
          store,
          {
            fetchLatestGameVersion: async () => "7.56x1",
            // Never finishes loading, so lookups are left waiting.
            fetchMarketBoardItems: () => new Promise(() => {}),
          },
          new InMemoryLockManager(),
        ),
      );
      void service.prepareItemData();
      await vi.waitFor(() =>
        expect(service.getItemDataStatus().state).toBe("loading"),
      );
      const controller = new AbortController();

      const lookup = service.getItem(6141, { signal: controller.signal });
      controller.abort(new Error("Cancelled"));

      await expect(lookup).rejects.toThrow("Cancelled");
      expect(mockedFetchItem).not.toHaveBeenCalled();
    });
  });

  describe("searching for items", () => {
    it("should give what XIVAPI finds, letting the search be cancelled", async () => {
      const { service } = await serviceCaching();
      const found = [cordial];
      mockedSearchItems.mockResolvedValue(found);
      const { signal } = new AbortController();

      expect(await service.searchItems("cordial", { signal })).toBe(found);
      expect(mockedSearchItems).toHaveBeenCalledWith("cordial", { signal });
    });
  });

  describe("Expert Delivery items", () => {
    it("should give the items worth at least the minimum seals, by their item levels' seal values", async () => {
      const { service } = await serviceCaching();
      mockedFetchCandidates.mockResolvedValue([
        { itemId: 1, name: "Below", itemLevel: 50 },
        { itemId: 8455, name: "Augmented Wolfram Cuirass", itemLevel: 90 },
      ]);
      mockedFetchSeals.mockResolvedValue(
        new Map([
          [50, 100],
          [90, 518],
        ]),
      );

      expect(await service.getExpertDeliveryItems(150)).toEqual([
        {
          itemId: 8455,
          name: "Augmented Wolfram Cuirass",
          itemLevel: 90,
          seals: 518,
        },
      ]);
    });

    it("should fail when either the items or the seal values can't be fetched", async () => {
      const { service } = await serviceCaching();
      mockedFetchCandidates.mockResolvedValue([]);
      mockedFetchSeals.mockRejectedValue(new Error("XIVAPI is down"));

      await expect(service.getExpertDeliveryItems(0)).rejects.toThrow(
        "XIVAPI is down",
      );
    });
  });

  describe("getting the item data ready", () => {
    it("should tell listeners how it's going, and be ready once done", async () => {
      const service = new CachingItemService(
        new ItemDataCache(
          new MemoryItemDataStore(),
          {
            fetchLatestGameVersion: async () => "7.56x1",
            fetchMarketBoardItems: async () => [cordial],
          },
          new InMemoryLockManager(),
        ),
      );
      const listener = vi.fn();
      service.subscribeToItemDataStatus(listener);

      await service.prepareItemData();

      expect(listener).toHaveBeenCalled();
      expect(service.getItemDataStatus()).toEqual({ state: "ready" });
    });
  });
});
