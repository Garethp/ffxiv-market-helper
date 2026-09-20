// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoredList } from "./StoredList";

const KEY = "test:stored-list";

beforeEach(() => {
  localStorage.clear();
});

describe("StoredList", () => {
  describe("reading it for the first time", () => {
    it("should start out as the initial items when nothing is saved", () => {
      expect(new StoredList(KEY, () => ["a", "b"]).read()).toEqual(["a", "b"]);
    });

    it("should save the initial items, so they're only worked out once", () => {
      const initial = vi.fn(() => [Math.random()]);
      const first = new StoredList(KEY, initial).read();

      expect(new StoredList(KEY, initial).read()).toEqual(first);
      expect(initial).toHaveBeenCalledTimes(1);
    });
  });

  it("should read back what was written, rather than the initial items", () => {
    new StoredList(KEY, () => ["initial"]).write(["written"]);

    expect(new StoredList(KEY, () => ["initial"]).read()).toEqual(["written"]);
  });

  it("should keep an empty list empty, rather than starting out as the initial items again", () => {
    new StoredList(KEY, () => ["initial"]).write([]);

    expect(new StoredList(KEY, () => ["initial"]).read()).toEqual([]);
  });

  it("should treat saved data that can't be read as an empty list", () => {
    localStorage.setItem(KEY, "{not json");

    expect(new StoredList(KEY, () => ["initial"]).read()).toEqual([]);
  });
});
