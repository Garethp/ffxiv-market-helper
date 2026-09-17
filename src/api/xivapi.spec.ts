import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Grants every request straight away, so these tests are only about what's requested and returned.
vi.mock("../requestLimiting/CrossTabRequestLimiter", () => ({
  CrossTabRequestLimiter: class {
    async acquire() {
      return () => {};
    }
  },
}));

import { fetchItem, searchItems } from "./xivapi";

const mockedFetch = vi.fn<typeof fetch>();

const searchResponse = (
  results: { row_id: number; fields: { Name: string; StackSize: number } }[],
) => new Response(JSON.stringify({ results }));

/** The search parameters of the one request made. */
const requestedSearch = () => {
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  return new URL(String(mockedFetch.mock.calls[0][0])).searchParams;
};

beforeEach(() => {
  vi.stubGlobal("fetch", mockedFetch);
  mockedFetch.mockResolvedValue(searchResponse([]));
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockedFetch.mockReset();
});

describe("searchItems", () => {
  it("should look for items sold on the market board whose names contain the text", async () => {
    await searchItems("cordial");

    const search = requestedSearch();
    expect(search.get("sheets")).toBe("Item");
    expect(search.get("query")).toBe('+Name~"cordial" -ItemSearchCategory=0');
  });

  it("should ask for at most 20 results", async () => {
    await searchItems("cordial");

    expect(requestedSearch().get("limit")).toBe("20");
  });

  it("should give each matching item's ID, name and stack size, in the order XIVAPI ranks them", async () => {
    mockedFetch.mockResolvedValue(
      searchResponse([
        { row_id: 6141, fields: { Name: "Cordial", StackSize: 999 } },
        { row_id: 16911, fields: { Name: "Watered Cordial", StackSize: 999 } },
      ]),
    );

    expect(await searchItems("cordial")).toEqual([
      { itemId: 6141, name: "Cordial", stackSize: 999 },
      { itemId: 16911, name: "Watered Cordial", stackSize: 999 },
    ]);
  });

  it("should ignore surrounding whitespace in the text", async () => {
    await searchItems("  cordial ");

    expect(requestedSearch().get("query")).toBe(
      '+Name~"cordial" -ItemSearchCategory=0',
    );
  });

  it("should leave quotes and backslashes out of the text, so they can't break the search", async () => {
    await searchItems('cor"di\\al');

    expect(requestedSearch().get("query")).toBe(
      '+Name~"cordial" -ItemSearchCategory=0',
    );
  });

  it("should fail when XIVAPI doesn't answer successfully", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(searchItems("cordial")).rejects.toThrow(
      "XIVAPI item search failed (500)",
    );
  });

  it("should let the search be cancelled", async () => {
    const controller = new AbortController();

    await searchItems("cordial", { signal: controller.signal });

    expect(mockedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe("fetchItem", () => {
  const itemResponse = (fields: { Name: string; StackSize: number }) =>
    new Response(JSON.stringify({ row_id: 6141, fields }));

  it("should give the item's name and stack size", async () => {
    mockedFetch.mockResolvedValue(
      itemResponse({ Name: "Cordial", StackSize: 999 }),
    );

    expect(await fetchItem(6141)).toEqual({ name: "Cordial", stackSize: 999 });
    const url = new URL(String(mockedFetch.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/sheet/Item/6141");
    expect(url.searchParams.get("fields")).toBe("Name,StackSize");
  });

  it("should give nothing for an item XIVAPI doesn't have", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 404 }));

    expect(await fetchItem(9999999)).toBeNull();
  });

  it("should give nothing for an item with no name", async () => {
    mockedFetch.mockResolvedValue(itemResponse({ Name: "", StackSize: 1 }));

    expect(await fetchItem(0)).toBeNull();
  });

  it("should fail when XIVAPI doesn't answer successfully", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchItem(6141)).rejects.toThrow(
      "XIVAPI item request failed (500)",
    );
  });

  it("should let the request be cancelled", async () => {
    mockedFetch.mockResolvedValue(
      itemResponse({ Name: "Cordial", StackSize: 999 }),
    );
    const controller = new AbortController();

    await fetchItem(6141, { signal: controller.signal });

    expect(mockedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
