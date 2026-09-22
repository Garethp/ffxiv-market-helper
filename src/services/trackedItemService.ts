import type { PricedItem, TrackedItem } from "../types";
import { personalConfig } from "./configService";
import { StoredList } from "./StoredList";
import { validateItem } from "../utils/validation/trackedItems";

/** The settings of a tracked item that can be changed once it's tracked. */
export type TrackedItemSettings = Pick<
  PricedItem,
  "hq" | "targetQuantity" | "sellPriceCeiling"
>;

/**
 * A change the tracked items wouldn't accept, carrying the reason worded for the
 * user. Callers check the rules first, so this reaching the UI means something
 * the user can't act on — a stale screen, or a caller that skipped its checks.
 */
export class TrackedItemChangeRefused extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "TrackedItemChangeRefused";
  }
}

/**
 * Source of the items we track, and where changes to them are made. Every
 * change either resolves, having been made, or rejects. Implementations can be
 * swapped out (e.g. for one backed by a real database/API) without touching any
 * calling code.
 */
export interface TrackedItemService {
  getTrackedItems(): Promise<TrackedItem[]>;
  /** Adds the item to the end of the tracked items. */
  trackItem(item: PricedItem): Promise<void>;
  updateTrackedItem(id: string, settings: TrackedItemSettings): Promise<void>;
  untrackItem(id: string): Promise<void>;
}

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

  async trackItem(item: PricedItem): Promise<void> {
    const trackedItems = this.storedItems.read();
    this.refuseIfInvalid(validateItem(item, trackedItems));
    this.storedItems.write([...trackedItems, withId(item)]);
  }

  async updateTrackedItem(
    id: string,
    { hq, targetQuantity, sellPriceCeiling }: TrackedItemSettings,
  ): Promise<void> {
    const trackedItems = this.storedItems.read();
    const existing = trackedItems.find((item) => item.id === id);
    if (!existing)
      throw new TrackedItemChangeRefused("This item is no longer tracked.");

    const changed = { ...existing, hq, targetQuantity, sellPriceCeiling };
    this.refuseIfInvalid(
      validateItem(changed, trackedItems, { excludingId: id }),
    );
    this.storedItems.write(
      trackedItems.map((item) => (item.id === id ? changed : item)),
    );
  }

  async untrackItem(id: string): Promise<void> {
    const trackedItems = this.storedItems.read();
    if (!trackedItems.some((item) => item.id === id)) {
      throw new TrackedItemChangeRefused("This item is no longer tracked.");
    }
    this.storedItems.write(trackedItems.filter((item) => item.id !== id));
  }

  /** Backstop for a caller that didn't check the rules, or a screen that's gone stale. */
  private refuseIfInvalid(reason: string | undefined): void {
    if (reason) throw new TrackedItemChangeRefused(reason);
  }
}

export const trackedItemService: TrackedItemService =
  new LocalStorageTrackedItemService(personalConfig.trackedItems ?? []);
