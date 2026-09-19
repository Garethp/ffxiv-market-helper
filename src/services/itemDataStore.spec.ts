import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDbItemDataStore } from "./itemDataStore";

let databaseCount = 0;

/** A store on a database of its own, so nothing carries over between tests. */
const newStore = () =>
  new IndexedDbItemDataStore(`item-data-test-${++databaseCount}`);

const cordial = { itemId: 6141, name: "Cordial", stackSize: 999 };
const darkMatter = {
  itemId: 5594,
  name: "Grade 8 Dark Matter",
  stackSize: 999,
};

describe("IndexedDbItemDataStore", () => {
  it("should have no version before any items are stored", async () => {
    expect(await newStore().getVersion()).toBeUndefined();
  });

  it("should give back stored items' details, and the version they're from", async () => {
    const store = newStore();

    await store.replaceItems("7.56x1", [cordial, darkMatter]);

    expect(await store.getVersion()).toBe("7.56x1");
    expect(await store.getItems([6141, 5594])).toEqual(
      new Map([
        [6141, { name: "Cordial", stackSize: 999 }],
        [5594, { name: "Grade 8 Dark Matter", stackSize: 999 }],
      ]),
    );
  });

  it("should leave out items that aren't stored", async () => {
    const store = newStore();
    await store.replaceItems("7.56x1", [cordial]);

    expect(await store.getItems([6141, 1])).toEqual(
      new Map([[6141, { name: "Cordial", stackSize: 999 }]]),
    );
  });

  it("should replace every stored item, not just add to them", async () => {
    const store = newStore();
    await store.replaceItems("7.55", [cordial, darkMatter]);

    await store.replaceItems("7.56x1", [{ ...cordial, name: "Renamed" }]);

    expect(await store.getVersion()).toBe("7.56x1");
    expect(await store.getItems([6141, 5594])).toEqual(
      new Map([[6141, { name: "Renamed", stackSize: 999 }]]),
    );
  });

  it("should keep what's stored for the next store opened on the same database", async () => {
    const name = `item-data-test-${++databaseCount}`;
    await new IndexedDbItemDataStore(name).replaceItems("7.56x1", [cordial]);

    const reopened = new IndexedDbItemDataStore(name);

    expect(await reopened.getVersion()).toBe("7.56x1");
    expect((await reopened.getItems([6141])).get(6141)?.name).toBe("Cordial");
  });
});
