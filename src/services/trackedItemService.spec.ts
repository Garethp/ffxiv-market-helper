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
  expect(await service.trackItem(item)).toEqual({ ok: true });
  const trackedItems = await service.getTrackedItems();
  return trackedItems[trackedItems.length - 1];
};

beforeEach(() => {
  localStorage.clear();
});

describe("trackedItemService", () => {
  describe("starting out", () => {
    it("should have no tracked items when there are no initial items", async () => {
      expect(await createService().getTrackedItems()).toEqual([]);
    });

    it("should start out tracking the initial items, in order, each given an ID", async () => {
      const materia = { ...cordial, itemId: 41771, name: "Materia" };

      expect(await createService([cordial, materia]).getTrackedItems()).toEqual(
        [
          { id: expect.any(String), ...cordial },
          { id: expect.any(String), ...materia },
        ],
      );
    });

    it("should keep the same IDs for the initial items on later visits", async () => {
      const firstVisit = await createService([cordial]).getTrackedItems();
      expect(firstVisit).toHaveLength(1);

      expect(await createService([cordial]).getTrackedItems()).toEqual(
        firstVisit,
      );
    });

    it("should treat unreadable saved data as having no tracked items", async () => {
      await trackItem(createService());
      localStorage.setItem(localStorage.key(0)!, "{not json");

      expect(await createService([cordial]).getTrackedItems()).toEqual([]);
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

    it("should remember the item for later visits", async () => {
      const tracked = await trackItem(createService());

      expect(await createService().getTrackedItems()).toEqual([tracked]);
    });

    it("should allow the same item to be tracked as both NQ and HQ", async () => {
      const service = createService();

      await service.trackItem(cordial);
      await service.trackItem({ ...cordial, hq: true });

      const [nq, hq] = await service.getTrackedItems();
      expect([nq?.hq, hq?.hq]).toEqual([undefined, true]);
      expect(nq.id).not.toBe(hq.id);
    });

    it.each([0, -5, 1.5])(
      "should refuse a target quantity of %s, which isn't a whole number of at least 1",
      async (targetQuantity) => {
        const service = createService();

        expect(await service.trackItem({ ...cordial, targetQuantity })).toEqual(
          { ok: false, error: { reason: "invalid-target-quantity" } },
        );
        expect(await service.getTrackedItems()).toEqual([]);
      },
    );

    it.each([-1, 10.5])(
      "should refuse a sell price ceiling of %s, which isn't a whole number of gil",
      async (sellPriceCeiling) => {
        const service = createService();

        expect(
          await service.trackItem({ ...cordial, sellPriceCeiling }),
        ).toEqual({
          ok: false,
          error: { reason: "invalid-sell-price-ceiling" },
        });
        expect(await service.getTrackedItems()).toEqual([]);
      },
    );

    it("should refuse to track an item again with the same quality", async () => {
      const service = createService();
      await trackItem(service, { ...cordial, hq: true });

      expect(
        await service.trackItem({ ...cordial, hq: true, targetQuantity: 5 }),
      ).toEqual({
        ok: false,
        error: { reason: "already-tracked", name: "Cordial", hq: true },
      });
      expect(await service.getTrackedItems()).toHaveLength(1);
    });

    it("should treat an item with no quality given as NQ when checking whether it's already tracked", async () => {
      const service = createService();
      await trackItem(service, { ...cordial, hq: false });

      expect(await service.trackItem(cordial)).toEqual({
        ok: false,
        error: { reason: "already-tracked", name: "Cordial", hq: false },
      });
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

      expect(
        await service.updateTrackedItem(tracked.id, { targetQuantity: 5 }),
      ).toEqual({ ok: true });
    });

    it("should refuse a quality the same item is already tracked with", async () => {
      const service = createService();
      await trackItem(service, { ...cordial, hq: true });
      const nq = await trackItem(service, cordial);

      expect(
        await service.updateTrackedItem(nq.id, {
          hq: true,
          targetQuantity: 999,
        }),
      ).toEqual({
        ok: false,
        error: { reason: "already-tracked", name: "Cordial", hq: true },
      });
      expect((await service.getTrackedItems())[1].hq).toBeUndefined();
    });

    it("should refuse a target quantity that isn't a whole number of at least 1", async () => {
      const service = createService();
      const tracked = await trackItem(service);

      expect(
        await service.updateTrackedItem(tracked.id, { targetQuantity: 0 }),
      ).toEqual({ ok: false, error: { reason: "invalid-target-quantity" } });
      expect((await service.getTrackedItems())[0].targetQuantity).toBe(999);
    });

    it("should refuse a sell price ceiling that isn't a whole number of gil", async () => {
      const service = createService();
      const tracked = await trackItem(service);

      expect(
        await service.updateTrackedItem(tracked.id, {
          targetQuantity: 999,
          sellPriceCeiling: -1,
        }),
      ).toEqual({ ok: false, error: { reason: "invalid-sell-price-ceiling" } });
      expect(
        (await service.getTrackedItems())[0].sellPriceCeiling,
      ).toBeUndefined();
    });

    it("should refuse to change an item that isn't tracked", async () => {
      expect(
        await createService().updateTrackedItem("missing", {
          targetQuantity: 1,
        }),
      ).toEqual({ ok: false, error: { reason: "not-found" } });
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

    it("should not bring the initial items back once every item has been removed", async () => {
      const service = createService([cordial]);
      const [tracked] = await service.getTrackedItems();

      await service.untrackItem(tracked.id);

      expect(await createService([cordial]).getTrackedItems()).toEqual([]);
    });

    it("should refuse to remove an item that isn't tracked", async () => {
      expect(await createService().untrackItem("missing")).toEqual({
        ok: false,
        error: { reason: "not-found" },
      });
    });
  });
});
