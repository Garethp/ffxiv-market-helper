import type { ItemDataStore } from "../services/itemDataStore";
import type { ItemDetails, ItemSearchResult } from "../types";

/** Holds its items in memory, standing in for IndexedDB. Caches sharing one behave like tabs sharing a database. */
export class MemoryItemDataStore implements ItemDataStore {
  version: string | undefined;
  items = new Map<number, ItemSearchResult>();

  async getVersion() {
    return this.version;
  }

  async replaceItems(version: string, items: ItemSearchResult[]) {
    this.version = version;
    this.items = new Map(items.map((item) => [item.itemId, item]));
  }

  async getItems(itemIds: number[]) {
    const found = new Map<number, ItemDetails>();
    itemIds.forEach((itemId) => {
      const item = this.items.get(itemId);
      if (item)
        found.set(itemId, { name: item.name, stackSize: item.stackSize });
    });
    return found;
  }
}
