import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ItemDetails, ItemSummary, MarketBoardItem } from "../types";

/**
 * Where item data is kept between visits, shared by every tab. Kept apart
 * from how it's fetched and when it's refreshed, so it can be swapped for
 * something else in tests.
 */
export interface ItemDataStore {
  /** The game version the stored items are from, or undefined when nothing's stored yet. */
  getVersion(): Promise<string | undefined>;
  /** Replaces every stored item, and the name of every kind of thing an item can be, all at once. */
  replaceItems(
    version: string,
    items: MarketBoardItem[],
    typeNames: Map<number, string>,
  ): Promise<void>;
  /** The stored details of whichever of the items are stored. */
  getItems(itemIds: number[]): Promise<Map<number, ItemDetails>>;
  /** What whichever of the items are stored are, including those the game says nothing about. */
  getSummaries(itemIds: number[]): Promise<Map<number, ItemSummary>>;
}

interface ItemDataSchema extends DBSchema {
  items: { key: number; value: MarketBoardItem };
  /** The name of each kind of thing an item can be, by the game's ID for it. */
  itemTypes: { key: number; value: string };
  meta: { key: "version"; value: string };
}

/**
 * Bumped whenever the stores' layout changes, or whenever what's stored for
 * each item does: stored items are only replaced when the game version
 * changes, so anything missing a newly-stored field would otherwise stay
 * missing until the next patch.
 */
const SCHEMA_VERSION = 3;

export class IndexedDbItemDataStore implements ItemDataStore {
  private database: Promise<IDBPDatabase<ItemDataSchema>> | undefined;

  constructor(private readonly databaseName: string) {}

  async getVersion(): Promise<string | undefined> {
    return (await this.open()).get("meta", "version");
  }

  async replaceItems(
    version: string,
    items: MarketBoardItem[],
    typeNames: Map<number, string>,
  ): Promise<void> {
    const transaction = (await this.open()).transaction(
      ["items", "itemTypes", "meta"],
      "readwrite",
    );
    const itemStore = transaction.objectStore("items");
    const typeStore = transaction.objectStore("itemTypes");
    // Queued without awaiting each one in turn, so they all go in the one transaction.
    await Promise.all([
      itemStore.clear(),
      typeStore.clear(),
      ...items.map((item) => itemStore.put(item)),
      ...Array.from(typeNames, ([typeId, name]) => typeStore.put(name, typeId)),
      transaction.objectStore("meta").put(version, "version"),
      transaction.done,
    ]);
  }

  async getItems(itemIds: number[]): Promise<Map<number, ItemDetails>> {
    const items = new Map<number, ItemDetails>();
    (await this.storedItems(itemIds)).forEach((item) =>
      items.set(item.itemId, { name: item.name, stackSize: item.stackSize }),
    );
    return items;
  }

  async getSummaries(itemIds: number[]): Promise<Map<number, ItemSummary>> {
    const items = await this.storedItems(itemIds);
    const database = await this.open();
    const types = await Promise.all(
      items.map((item) => database.get("itemTypes", item.typeId)),
    );
    return new Map(
      items.map((item, i) => [
        item.itemId,
        { type: types[i], description: item.description },
      ]),
    );
  }

  private async storedItems(itemIds: number[]): Promise<MarketBoardItem[]> {
    const transaction = (await this.open()).transaction("items");
    const found = await Promise.all(
      itemIds.map((itemId) => transaction.store.get(itemId)),
    );
    return found.filter((item) => item !== undefined);
  }

  private open(): Promise<IDBPDatabase<ItemDataSchema>> {
    this.database ??= openDB<ItemDataSchema>(
      this.databaseName,
      SCHEMA_VERSION,
      {
        upgrade(database, oldVersion, _newVersion, transaction) {
          if (!database.objectStoreNames.contains("items")) {
            database.createObjectStore("items", { keyPath: "itemId" });
          }
          if (!database.objectStoreNames.contains("itemTypes")) {
            database.createObjectStore("itemTypes");
          }
          if (!database.objectStoreNames.contains("meta")) {
            database.createObjectStore("meta");
          }
          if (oldVersion < 1) return;
          // Items stored under an older layout are missing whatever's been added since, so they're
          // dropped; forgetting the version they were from is what reloads them.
          void transaction.objectStore("items").clear();
          void transaction.objectStore("itemTypes").clear();
          void transaction.objectStore("meta").delete("version");
        },
        // A tab on a newer layout can't upgrade the database while this one holds it open.
        blocking: () => this.close(),
      },
    );
    return this.database;
  }

  private close(): void {
    const database = this.database;
    this.database = undefined;
    void database?.then((open) => open.close());
  }
}
