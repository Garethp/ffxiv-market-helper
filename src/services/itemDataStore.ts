import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ItemDetails, ItemSearchResult } from "../types";

/**
 * Where item data is kept between visits, shared by every tab. Kept apart
 * from how it's fetched and when it's refreshed, so it can be swapped for
 * something else in tests.
 */
export interface ItemDataStore {
  /** The game version the stored items are from, or undefined when nothing's stored yet. */
  getVersion(): Promise<string | undefined>;
  /** Replaces every stored item with these, as of the given game version, all at once. */
  replaceItems(version: string, items: ItemSearchResult[]): Promise<void>;
  /** The stored details of whichever of the items are stored. */
  getItems(itemIds: number[]): Promise<Map<number, ItemDetails>>;
}

interface ItemDataSchema extends DBSchema {
  items: { key: number; value: ItemSearchResult };
  meta: { key: "version"; value: string };
}

/** Bumped whenever the stores' layout changes. */
const SCHEMA_VERSION = 1;

export class IndexedDbItemDataStore implements ItemDataStore {
  private database: Promise<IDBPDatabase<ItemDataSchema>> | undefined;

  constructor(private readonly databaseName: string) {}

  async getVersion(): Promise<string | undefined> {
    return (await this.open()).get("meta", "version");
  }

  async replaceItems(
    version: string,
    items: ItemSearchResult[],
  ): Promise<void> {
    const transaction = (await this.open()).transaction(
      ["items", "meta"],
      "readwrite",
    );
    const itemStore = transaction.objectStore("items");
    // Queued without awaiting each one in turn, so they all go in the one transaction.
    await Promise.all([
      itemStore.clear(),
      ...items.map((item) => itemStore.put(item)),
      transaction.objectStore("meta").put(version, "version"),
      transaction.done,
    ]);
  }

  async getItems(itemIds: number[]): Promise<Map<number, ItemDetails>> {
    const transaction = (await this.open()).transaction("items");
    const found = await Promise.all(
      itemIds.map((itemId) => transaction.store.get(itemId)),
    );
    const items = new Map<number, ItemDetails>();
    found.forEach((item) => {
      if (item)
        items.set(item.itemId, { name: item.name, stackSize: item.stackSize });
    });
    return items;
  }

  private open(): Promise<IDBPDatabase<ItemDataSchema>> {
    this.database ??= openDB<ItemDataSchema>(
      this.databaseName,
      SCHEMA_VERSION,
      {
        upgrade(database) {
          database.createObjectStore("items", { keyPath: "itemId" });
          database.createObjectStore("meta");
        },
      },
    );
    return this.database;
  }
}
