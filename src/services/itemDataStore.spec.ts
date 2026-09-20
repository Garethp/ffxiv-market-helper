import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { IndexedDbItemDataStore } from "./itemDataStore";

let databaseCount = 0;

/** A store on a database of its own, so nothing carries over between tests. */
const newStore = () =>
  new IndexedDbItemDataStore(`item-data-test-${++databaseCount}`);

const cordial = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
  description: "A sweet, fermented concoction.",
  typeId: 44,
};
const darkMatter = {
  itemId: 5594,
  name: "Grade 8 Dark Matter",
  stackSize: 999,
  description: "",
  typeId: 59,
};

const typeNames = new Map([
  [44, "Medicine"],
  [59, "Materia"],
]);

describe("IndexedDbItemDataStore", () => {
  it("should leave out items that aren't stored", async () => {
    const store = newStore();
    await store.replaceItems("7.56x1", [cordial], typeNames);

    expect(await store.getItems([6141, 1])).toEqual(
      new Map([[6141, { name: "Cordial", stackSize: 999 }]]),
    );
  });

  it("should replace every stored item, not just add to them", async () => {
    const store = newStore();
    await store.replaceItems("7.55", [cordial, darkMatter], typeNames);

    await store.replaceItems(
      "7.56x1",
      [{ ...cordial, name: "Renamed" }],
      typeNames,
    );

    expect(await store.getVersion()).toBe("7.56x1");
    expect(await store.getItems([6141, 5594])).toEqual(
      new Map([[6141, { name: "Renamed", stackSize: 999 }]]),
    );
  });

  it("should give what stored items are, including the items the game says nothing about", async () => {
    const store = newStore();
    await store.replaceItems("7.56x1", [cordial, darkMatter], typeNames);

    expect(await store.getSummaries([6141, 5594, 1])).toEqual(
      new Map([
        [
          6141,
          { type: "Medicine", description: "A sweet, fermented concoction." },
        ],
        [5594, { type: "Materia", description: "" }],
      ]),
    );
  });

  it("should drop items stored under an older layout, so they're loaded again", async () => {
    const name = `item-data-test-${++databaseCount}`;
    // The layout before descriptions were stored.
    const old = await openDB(name, 1, {
      upgrade(database) {
        database.createObjectStore("items", { keyPath: "itemId" });
        database.createObjectStore("meta");
      },
    });
    await old.put("items", { itemId: 6141, name: "Cordial", stackSize: 999 });
    await old.put("meta", "7.56x1", "version");
    old.close();

    const store = new IndexedDbItemDataStore(name);

    expect(await store.getVersion()).toBeUndefined();
    expect(await store.getItems([6141])).toEqual(new Map());
  });
});
