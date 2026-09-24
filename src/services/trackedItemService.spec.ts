// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { PricedItem, TrackedItem } from "../types";
import {
  LocalStorageTrackedItemService,
  type TrackedItemService,
} from "./trackedItemService";

const createService = (initialItems: PricedItem[] = []) =>
  new LocalStorageTrackedItemService(initialItems);

const cordial: PricedItem = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
  targetQuantity: 999,
};

/** Tracks an item and returns it as saved. */
const trackItem = async (
  service: TrackedItemService,
  item: PricedItem = cordial,
): Promise<TrackedItem> => {
  await service.trackItem(item);
  const trackedItems = await service.getTrackedItems();
  return trackedItems[trackedItems.length - 1];
};

describe("trackedItemService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("starting out", () => {
    it("should start out tracking the initial items, in order, each given an ID", async () => {
      const materia = { ...cordial, itemId: 41771, name: "Materia" };

      expect(await createService([cordial, materia]).getTrackedItems()).toEqual(
        [
          { id: expect.any(String), ...cordial },
          { id: expect.any(String), ...materia },
        ],
      );
    });
  });

  describe("tracking an item", () => {
    it("should add the item after the ones already tracked", async () => {
      const service = createService([cordial]);
      const materia = { ...cordial, itemId: 41771, name: "Materia" };

      await service.trackItem(materia);

      expect(await service.getTrackedItems()).toEqual([
        { id: expect.any(String), ...cordial },
        { id: expect.any(String), ...materia },
      ]);
    });

    it("should allow the same item to be tracked as both NQ and HQ", async () => {
      const service = createService();

      await service.trackItem(cordial);
      await service.trackItem({ ...cordial, hq: true });

      const [nq, hq] = await service.getTrackedItems();
      expect([nq?.hq, hq?.hq]).toEqual([undefined, true]);
      expect(nq.id).not.toBe(hq.id);
    });

    it.each([0, 1.5])(
      "should not track a target quantity of %s, which isn't a whole number of at least 1",
      async (targetQuantity) => {
        const service = createService();

        await expect(
          service.trackItem({ ...cordial, targetQuantity }),
        ).rejects.toThrow(
          "Target quantity needs to be a whole number of at least 1.",
        );
        expect(await service.getTrackedItems()).toEqual([]);
      },
    );

    it.each([-1, 10.5])(
      "should not track a sell price ceiling of %s, which isn't a whole number of gil",
      async (sellPriceCeiling) => {
        const service = createService();

        await expect(
          service.trackItem({ ...cordial, sellPriceCeiling }),
        ).rejects.toThrow(
          "Sell price ceiling needs to be a whole number of gil, or left empty.",
        );
        expect(await service.getTrackedItems()).toEqual([]);
      },
    );

    it("should treat an item with no quality given as NQ when checking whether it's already tracked", async () => {
      const service = createService();
      await trackItem(service, { ...cordial, hq: false });

      await expect(service.trackItem(cordial)).rejects.toThrow(
        "Cordial is already tracked as NQ.",
      );
    });
  });

  describe("changing a tracked item's settings", () => {
    it("should replace its quality, target quantity and sell price ceiling, keeping everything else", async () => {
      const service = createService();
      const tracked = await trackItem(service);

      await service.updateTrackedItem(tracked.id, {
        hq: true,
        targetQuantity: 50,
        sellPriceCeiling: 1_000,
      });

      expect(await service.getTrackedItems()).toEqual([
        { ...tracked, hq: true, targetQuantity: 50, sellPriceCeiling: 1_000 },
      ]);
    });

    it("should remove the sell price ceiling when none is given", async () => {
      const service = createService();
      const tracked = await trackItem(service, {
        ...cordial,
        sellPriceCeiling: 1_000,
      });

      await service.updateTrackedItem(tracked.id, { targetQuantity: 99 });

      const [changed] = await service.getTrackedItems();
      expect(changed.sellPriceCeiling).toBeUndefined();
    });

    it("should allow an item to keep its own quality", async () => {
      const service = createService();
      const tracked = await trackItem(service);

      await service.updateTrackedItem(tracked.id, { targetQuantity: 5 });
    });

    it("should not save a quality the same item is already tracked with", async () => {
      const service = createService();
      await trackItem(service, { ...cordial, hq: true });
      const nq = await trackItem(service, cordial);

      await expect(
        service.updateTrackedItem(nq.id, { hq: true, targetQuantity: 999 }),
      ).rejects.toThrow("Cordial is already tracked as HQ.");
      expect((await service.getTrackedItems())[1].hq).toBeUndefined();
    });

    it("should fail to change an item that isn't tracked", async () => {
      await expect(
        createService().updateTrackedItem("missing", { targetQuantity: 1 }),
      ).rejects.toThrow("This item is no longer tracked.");
    });
  });

  describe("no longer tracking an item", () => {
    it("should remove only that item", async () => {
      const service = createService();
      const nq = await trackItem(service, cordial);
      const hq = await trackItem(service, { ...cordial, hq: true });

      await service.untrackItem(nq.id);

      expect(await service.getTrackedItems()).toEqual([hq]);
    });

    it("should fail to remove an item that isn't tracked", async () => {
      await expect(createService().untrackItem("missing")).rejects.toThrow(
        "This item is no longer tracked.",
      );
    });
  });
});
