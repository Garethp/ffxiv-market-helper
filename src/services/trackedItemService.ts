import type { PricedItem, TrackedItem } from "../types";
import { personalConfig } from "./configService";
import { StoredList } from "./StoredList";

/** The settings of a tracked item that can be changed once it's tracked. */
export type TrackedItemSettings = Pick<
  PricedItem,
  "hq" | "targetQuantity" | "sellPriceCeiling"
>;

/** Why a change to the tracked items was refused. */
export type TrackedItemChangeError =
  | { reason: "invalid-target-quantity" }
  | { reason: "invalid-sell-price-ceiling" }
  | { reason: "already-tracked"; name: string; hq: boolean }
  | { reason: "not-found" };

export type TrackedItemChangeResult =
  { ok: true } | { ok: false; error: TrackedItemChangeError };

/**
 * Source of the items we track, and where changes to them are made.
 * Implementations can be swapped out (e.g. for one backed by a real
 * database/API) without touching any calling code.
 */
export interface TrackedItemService {
  getTrackedItems(): Promise<TrackedItem[]>;
  /** Adds the item to the end of the tracked items. */
  trackItem(item: PricedItem): Promise<TrackedItemChangeResult>;
  updateTrackedItem(
    id: string,
    settings: TrackedItemSettings,
  ): Promise<TrackedItemChangeResult>;
  untrackItem(id: string): Promise<TrackedItemChangeResult>;
}

/** Why the item can't be tracked as it is alongside the other tracked items, if there's a reason. */
const checkItem = (
  item: PricedItem,
  others: TrackedItem[],
): TrackedItemChangeError | undefined => {
  if (!Number.isInteger(item.targetQuantity) || item.targetQuantity < 1) {
    return { reason: "invalid-target-quantity" };
  }
  const ceiling = item.sellPriceCeiling;
  if (ceiling !== undefined && (!Number.isInteger(ceiling) || ceiling < 0)) {
    return { reason: "invalid-sell-price-ceiling" };
  }
  const hq = item.hq ?? false;
  const isAlreadyTracked = others.some(
    (other) => other.itemId === item.itemId && (other.hq ?? false) === hq,
  );
  if (isAlreadyTracked) {
    return { reason: "already-tracked", name: item.name, hq };
  }
  return undefined;
};

const withId = (item: PricedItem): TrackedItem => ({
  id: crypto.randomUUID(),
  ...item,
});

// Versioned so a later change to TrackedItem's shape can't be misread from an older save.
const STORAGE_KEY = "ffxiv-trading:tracked-items:v1";

/**
 * Keeps the tracked items in this browser's localStorage. The first time it's
 * loaded in a browser with none saved, it starts out as a copy of the initial
 * items.
 */
export class LocalStorageTrackedItemService implements TrackedItemService {
  private readonly storedItems: StoredList<TrackedItem>;

  constructor(initialItems: PricedItem[]) {
    this.storedItems = new StoredList(STORAGE_KEY, () =>
      initialItems.map(withId),
    );
  }

  async getTrackedItems(): Promise<TrackedItem[]> {
    return this.storedItems.read();
  }

  async trackItem(item: PricedItem): Promise<TrackedItemChangeResult> {
    const trackedItems = this.storedItems.read();
    const error = checkItem(item, trackedItems);
    if (error) return { ok: false, error };
    this.storedItems.write([...trackedItems, withId(item)]);
    return { ok: true };
  }

  async updateTrackedItem(
    id: string,
    { hq, targetQuantity, sellPriceCeiling }: TrackedItemSettings,
  ): Promise<TrackedItemChangeResult> {
    const trackedItems = this.storedItems.read();
    const existing = trackedItems.find((item) => item.id === id);
    if (!existing) return { ok: false, error: { reason: "not-found" } };

    const changed = { ...existing, hq, targetQuantity, sellPriceCeiling };
    const others = trackedItems.filter((item) => item.id !== id);
    const error = checkItem(changed, others);
    if (error) return { ok: false, error };
    this.storedItems.write(
      trackedItems.map((item) => (item.id === id ? changed : item)),
    );
    return { ok: true };
  }

  async untrackItem(id: string): Promise<TrackedItemChangeResult> {
    const trackedItems = this.storedItems.read();
    if (!trackedItems.some((item) => item.id === id)) {
      return { ok: false, error: { reason: "not-found" } };
    }
    this.storedItems.write(trackedItems.filter((item) => item.id !== id));
    return { ok: true };
  }
}

export const trackedItemService: TrackedItemService =
  new LocalStorageTrackedItemService(personalConfig.trackedItems ?? []);
