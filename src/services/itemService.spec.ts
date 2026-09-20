import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/xivapi", () => ({
  fetchExpertDeliveryCandidates: vi.fn(),
  fetchExpertDeliverySealsByItemLevel: vi.fn(),
  fetchItem: vi.fn(),
  fetchItemSummaries: vi.fn(),
  fetchItemNames: vi.fn(),
  fetchItemTypeNames: vi.fn(),
  fetchLatestGameVersion: vi.fn(),
  fetchMarketBoardItems: vi.fn(),
  searchItems: vi.fn(),
}));

import {
  fetchExpertDeliveryCandidates,
  fetchExpertDeliverySealsByItemLevel,
  fetchItem,
  fetchItemSummaries,
  fetchItemNames,
} from "../api/xivapi";
import { InMemoryLockManager } from "../requestLimiting/InMemoryLockManager";
import { MemoryItemDataStore } from "../testing/MemoryItemDataStore";
import type { MarketBoardItem } from "../types";
import { ItemDataCache } from "./itemDataCache";
import { CachingItemService } from "./itemService";

const mockedFetchCandidates = vi.mocked(fetchExpertDeliveryCandidates);
const mockedFetchSeals = vi.mocked(fetchExpertDeliverySealsByItemLevel);
const mockedFetchItem = vi.mocked(fetchItem);
const mockedFetchItemNames = vi.mocked(fetchItemNames);
const mockedFetchItemSummaries = vi.mocked(fetchItemSummaries);

const cordial = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
  description: "A sweet, fermented concoction.",
  typeId: 44,
};

/** An item service whose cache holds the given market board items, already loaded. */
const serviceCaching = async (items: MarketBoardItem[] = [cordial]) => {
  const store = new MemoryItemDataStore();
  const cache = new ItemDataCache(
    store,
    {
      fetchLatestGameVersion: async () => "7.56x1",
      fetchMarketBoardItems: async () => items,
      fetchItemTypeNames: async () => new Map([[44, "Medicine"]]),
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

    it("should give up, rather than ask XIVAPI, when cancelled while waiting for the cache", async () => {
      const store = new MemoryItemDataStore();
      const service = new CachingItemService(
        new ItemDataCache(
          store,
          {
            fetchLatestGameVersion: async () => "7.56x1",
            // Never finishes loading, so lookups are left waiting.
            fetchMarketBoardItems: () => new Promise(() => {}),
            fetchItemTypeNames: async () => new Map(),
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
  });

  describe("what an item is", () => {
    const cordialSummary = {
      type: "Medicine",
      description: "A sweet, fermented concoction.",
    };

    it("should give cached summaries without asking XIVAPI", async () => {
      const { service } = await serviceCaching();

      expect(await service.getItemSummaries([6141])).toEqual(
        new Map([[6141, cordialSummary]]),
      );
      expect(mockedFetchItemSummaries).not.toHaveBeenCalled();
    });

    it("should ask XIVAPI for only the items that aren't cached", async () => {
      const { service } = await serviceCaching();
      mockedFetchItemSummaries.mockResolvedValue(
        new Map([[5594, { type: "Materia", description: "" }]]),
      );

      expect(await service.getItemSummaries([6141, 5594])).toEqual(
        new Map([
          [6141, cordialSummary],
          [5594, { type: "Materia", description: "" }],
        ]),
      );
      expect(mockedFetchItemSummaries).toHaveBeenCalledWith([5594]);
    });

    it("should ask XIVAPI for everything when the cache can't be read", async () => {
      const { service, store } = await serviceCaching();
      store.getSummaries = () => Promise.reject(new Error("No IndexedDB"));
      mockedFetchItemSummaries.mockResolvedValue(
        new Map([[6141, cordialSummary]]),
      );

      expect(await service.getItemSummaries([6141])).toEqual(
        new Map([[6141, cordialSummary]]),
      );
      expect(mockedFetchItemSummaries).toHaveBeenCalledWith([6141]);
    });
  });
});
