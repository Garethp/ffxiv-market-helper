import type { ItemDataStore } from "../services/itemDataStore";
import type { ItemDetails, ItemSummary, MarketBoardItem } from "../types";

/** Holds its items in memory, standing in for IndexedDB. Caches sharing one behave like tabs sharing a database. */
export class MemoryItemDataStore implements ItemDataStore {
  version?: string;
  items = new Map<number, MarketBoardItem>();
  typeNames = new Map<number, string>();

  async getVersion() {
    return this.version;
  }

  async replaceItems(
    version: string,
    items: MarketBoardItem[],
    typeNames: Map<number, string>,
  ) {
    this.version = version;
    this.items = new Map(items.map((item) => [item.itemId, item]));
    this.typeNames = new Map(typeNames);
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

  async getSummaries(itemIds: number[]) {
    const found = new Map<number, ItemSummary>();
    itemIds.forEach((itemId) => {
      const item = this.items.get(itemId);
      if (item) {
        found.set(itemId, {
          type: this.typeNames.get(item.typeId),
          description: item.description,
        });
      }
    });
    return found;
  }
}
