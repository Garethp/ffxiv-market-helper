import {
  fetchExpertDeliveryCandidates,
  fetchExpertDeliverySealsByItemLevel,
  fetchItem,
  fetchItemNames,
  fetchLatestGameVersion,
  fetchMarketBoardItems,
  searchItems,
} from "../api/xivapi";
import type { ItemDetails, ItemSearchResult } from "../types";
import {
  selectExpertDeliveryItems,
  type ExpertDeliveryItem,
} from "./expertDelivery";
import { ItemDataCache, type ItemDataStatus } from "./itemDataCache";
import { IndexedDbItemDataStore } from "./itemDataStore";

/**
 * Source of what the game's own data says about items: their names and
 * stack sizes, and which can be handed in for Expert Deliveries.
 * Implementations can be swapped out (e.g. for one backed by a real backend)
 * without touching any calling code.
 */
export interface ItemService {
  /** Names for the given items. An item with no known name is left out, rather than failing the whole lookup. */
  getItemNames(itemIds: number[]): Promise<Map<number, string>>;
  /** An item's details, or nothing for an ID that isn't a real, named item. */
  getItem(
    itemId: number,
    options?: { signal?: AbortSignal },
  ): Promise<ItemDetails | null>;
  /** Items that can be sold on the market board whose names contain the text, ignoring case, best match first. */
  searchItems(
    text: string,
    options?: { signal?: AbortSignal },
  ): Promise<ItemSearchResult[]>;
  /**
   * Items on the market board that hand in for at least the given number of
   * seals in an Expert Delivery, fewest seals first.
   */
  getExpertDeliveryItems(minimumSeals: number): Promise<ExpertDeliveryItem[]>;
  /** Gets the item data ready to be looked up quickly, if it isn't already. Only does so once, however often it's called. */
  prepareItemData(): Promise<void>;
  /** How far getting the item data ready has got. */
  getItemDataStatus(): ItemDataStatus;
  /** Calls the listener whenever the item data's status changes, until the returned function is called. */
  subscribeToItemDataStatus(listener: () => void): () => void;
}

/**
 * Keeps every market board item's name and stack size in a local cache,
 * refreshed once per game version, and asks XIVAPI for anything else. A cache
 * that can't be read is treated as empty, so lookups still work without it.
 */
export class CachingItemService implements ItemService {
  constructor(private readonly cache: ItemDataCache) {}

  async getItemNames(itemIds: number[]): Promise<Map<number, string>> {
    const cached = await this.cachedItems(itemIds);
    const names = new Map(
      Array.from(cached, ([itemId, item]) => [itemId, item.name]),
    );
    const uncached = itemIds.filter((itemId) => !cached.has(itemId));
    if (uncached.length > 0) {
      (await fetchItemNames(uncached)).forEach((name, itemId) =>
        names.set(itemId, name),
      );
    }
    return names;
  }

  async getItem(
    itemId: number,
    options?: { signal?: AbortSignal },
  ): Promise<ItemDetails | null> {
    const cached = (await this.cachedItems([itemId], options)).get(itemId);
    return cached ?? fetchItem(itemId, options);
  }

  searchItems(
    text: string,
    options?: { signal?: AbortSignal },
  ): Promise<ItemSearchResult[]> {
    return searchItems(text, options);
  }

  async getExpertDeliveryItems(
    minimumSeals: number,
  ): Promise<ExpertDeliveryItem[]> {
    const [candidates, sealsByItemLevel] = await Promise.all([
      fetchExpertDeliveryCandidates(),
      fetchExpertDeliverySealsByItemLevel(),
    ]);
    return selectExpertDeliveryItems(
      candidates,
      sealsByItemLevel,
      minimumSeals,
    );
  }

  prepareItemData(): Promise<void> {
    return this.cache.update();
  }

  getItemDataStatus(): ItemDataStatus {
    return this.cache.getStatus();
  }

  subscribeToItemDataStatus(listener: () => void): () => void {
    return this.cache.subscribe(listener);
  }

  private async cachedItems(
    itemIds: number[],
    options?: { signal?: AbortSignal },
  ): Promise<Map<number, ItemDetails>> {
    try {
      return await this.cache.getItems(itemIds, options);
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      return new Map();
    }
  }
}

export const itemService: ItemService = new CachingItemService(
  new ItemDataCache(new IndexedDbItemDataStore("ffxiv-trading-items"), {
    fetchLatestGameVersion,
    fetchMarketBoardItems,
  }),
);
