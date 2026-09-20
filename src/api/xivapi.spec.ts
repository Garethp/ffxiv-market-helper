import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Grants every request straight away, so these tests are only about what's requested and returned.
vi.mock("../requestLimiting/CrossTabRequestLimiter", () => ({
  CrossTabRequestLimiter: class {
    async acquire() {
      return () => {};
    }
  },
}));

import {
  fetchExpertDeliveryCandidates,
  fetchExpertDeliverySealsByItemLevel,
  fetchItem,
  fetchItemSummaries,
  fetchItemTypeNames,
  fetchLatestGameVersion,
  fetchMarketBoardItems,
  searchItems,
} from "./xivapi";

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

describe("fetchExpertDeliverySealsByItemLevel", () => {
  const sealsPage = (rows: [itemLevel: number, seals: number][]) =>
    new Response(
      JSON.stringify({
        rows: rows.map(([row_id, SealsExpertDelivery]) => ({
          row_id,
          fields: { SealsExpertDelivery },
        })),
      }),
    );

  const requestedUrls = () =>
    mockedFetch.mock.calls.map(([url]) => new URL(String(url)));

  it("should give the seals for each item level", async () => {
    mockedFetch
      .mockResolvedValueOnce(
        sealsPage([
          [0, 0],
          [1, 6],
          [90, 518],
        ]),
      )
      .mockResolvedValueOnce(sealsPage([]));

    expect(await fetchExpertDeliverySealsByItemLevel()).toEqual(
      new Map([
        [0, 0],
        [1, 6],
        [90, 518],
      ]),
    );
    const [url] = requestedUrls();
    expect(url.pathname).toBe("/api/sheet/GCSupplyDutyReward");
    expect(url.searchParams.get("fields")).toBe("SealsExpertDelivery");
  });

  it("should carry on from the last item level of each page until a page comes back empty", async () => {
    mockedFetch
      .mockResolvedValueOnce(
        sealsPage([
          [0, 0],
          [1, 6],
        ]),
      )
      .mockResolvedValueOnce(sealsPage([[2, 12]]))
      .mockResolvedValueOnce(sealsPage([]));

    expect(await fetchExpertDeliverySealsByItemLevel()).toEqual(
      new Map([
        [0, 0],
        [1, 6],
        [2, 12],
      ]),
    );
    expect(requestedUrls().map((url) => url.searchParams.get("after"))).toEqual(
      [null, "1", "2"],
    );
  });

  it("should fail when XIVAPI doesn't answer successfully", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchExpertDeliverySealsByItemLevel()).rejects.toThrow(
      "XIVAPI Expert Delivery seals request failed (500)",
    );
  });
});

describe("fetchExpertDeliveryCandidates", () => {
  const candidatesPage = (
    results: { row_id: number; name: string; itemLevel: number }[],
    next?: string,
  ) =>
    new Response(
      JSON.stringify({
        next,
        results: results.map(({ row_id, name, itemLevel }) => ({
          row_id,
          fields: { Name: name, "LevelItem@as(raw)": itemLevel },
        })),
      }),
    );

  const requestedSearches = () =>
    mockedFetch.mock.calls.map(([url]) => new URL(String(url)).searchParams);

  it("should give each item's ID, name and item level", async () => {
    mockedFetch.mockResolvedValue(
      candidatesPage([
        { row_id: 8455, name: "Augmented Wolfram Cuirass", itemLevel: 90 },
      ]),
    );

    expect(await fetchExpertDeliveryCandidates()).toEqual([
      { itemId: 8455, name: "Augmented Wolfram Cuirass", itemLevel: 90 },
    ]);
    expect(requestedSearches()[0].get("fields")).toBe("Name,LevelItem@as(raw)");
  });

  it("should follow the search onto every further page, asking for the same fields", async () => {
    mockedFetch
      .mockResolvedValueOnce(
        candidatesPage([{ row_id: 1, name: "First", itemLevel: 10 }], "page-2"),
      )
      .mockResolvedValueOnce(
        candidatesPage(
          [{ row_id: 2, name: "Second", itemLevel: 20 }],
          "page-3",
        ),
      )
      .mockResolvedValueOnce(
        candidatesPage([{ row_id: 3, name: "Third", itemLevel: 30 }]),
      );

    expect(
      (await fetchExpertDeliveryCandidates()).map((item) => item.itemId),
    ).toEqual([1, 2, 3]);
    const searches = requestedSearches();
    expect(searches.map((search) => search.get("cursor"))).toEqual([
      null,
      "page-2",
      "page-3",
    ]);
    searches.forEach((search) => {
      expect(search.get("fields")).toBe("Name,LevelItem@as(raw)");
      expect(search.get("limit")).toBe("500");
    });
  });

  it("should fail when XIVAPI doesn't answer successfully", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchExpertDeliveryCandidates()).rejects.toThrow(
      "XIVAPI Expert Delivery item search failed (500)",
    );
  });
});

describe("fetchLatestGameVersion", () => {
  it("should give the key of the version XIVAPI marks as latest", async () => {
    mockedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          versions: [
            { key: "f815390159effefd", names: ["7.0"] },
            { key: "541c0c12e07da325", names: ["7.56x1", "latest"] },
          ],
        }),
      ),
    );

    expect(await fetchLatestGameVersion()).toBe("541c0c12e07da325");
    expect(String(mockedFetch.mock.calls[0][0])).toBe(
      "https://v2.xivapi.com/api/version",
    );
  });

  it("should fail when no version is marked as latest", async () => {
    mockedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          versions: [{ key: "f815390159effefd", names: ["7.0"] }],
        }),
      ),
    );

    await expect(fetchLatestGameVersion()).rejects.toThrow(
      "XIVAPI didn't say which version is latest",
    );
  });

  it("should fail when XIVAPI doesn't answer successfully", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchLatestGameVersion()).rejects.toThrow(
      "XIVAPI version request failed (500)",
    );
  });
});

describe("fetchMarketBoardItems", () => {
  const itemsPage = (
    results: {
      row_id: number;
      name: string;
      stackSize: number;
      description?: string;
      typeId?: number;
    }[],
    next?: string,
  ) =>
    new Response(
      JSON.stringify({
        next,
        results: results.map(
          ({ row_id, name, stackSize, description, typeId }) => ({
            row_id,
            fields: {
              Name: name,
              StackSize: stackSize,
              Description: description ?? "",
              "ItemUICategory@as(raw)": typeId ?? 0,
            },
          }),
        ),
      }),
    );

  const requestedSearches = () =>
    mockedFetch.mock.calls.map(([url]) => new URL(String(url)).searchParams);

  it("should look for items that can be sold on the market board, giving each one's ID, name, stack size, description and type", async () => {
    mockedFetch.mockResolvedValue(
      itemsPage([
        {
          row_id: 6141,
          name: "Cordial",
          stackSize: 999,
          description: "A sweet, fermented concoction.",
          typeId: 44,
        },
      ]),
    );

    expect(await fetchMarketBoardItems("541c0c12e07da325")).toEqual([
      {
        itemId: 6141,
        name: "Cordial",
        stackSize: 999,
        description: "A sweet, fermented concoction.",
        typeId: 44,
      },
    ]);
    const [search] = requestedSearches();
    expect(search.get("sheets")).toBe("Item");
    expect(search.get("query")).toBe("-ItemSearchCategory=0");
    expect(search.get("fields")).toBe(
      "Name,StackSize,Description,ItemUICategory@as(raw)",
    );
  });

  it("should follow the search onto every page, asking for the same version and fields on each", async () => {
    mockedFetch
      .mockResolvedValueOnce(
        itemsPage([{ row_id: 1, name: "First", stackSize: 1 }], "page-2"),
      )
      .mockResolvedValueOnce(
        itemsPage([{ row_id: 2, name: "Second", stackSize: 1 }]),
      );

    const items = await fetchMarketBoardItems("541c0c12e07da325");

    expect(items.map((item) => item.itemId)).toEqual([1, 2]);
    const searches = requestedSearches();
    expect(searches.map((search) => search.get("cursor"))).toEqual([
      null,
      "page-2",
    ]);
    searches.forEach((search) => {
      expect(search.get("version")).toBe("541c0c12e07da325");
      expect(search.get("fields")).toBe(
        "Name,StackSize,Description,ItemUICategory@as(raw)",
      );
      expect(search.get("limit")).toBe("500");
    });
  });

  it("should report how many items have come back after each page", async () => {
    mockedFetch
      .mockResolvedValueOnce(
        itemsPage(
          [
            { row_id: 1, name: "First", stackSize: 1 },
            { row_id: 2, name: "Second", stackSize: 1 },
          ],
          "page-2",
        ),
      )
      .mockResolvedValueOnce(
        itemsPage([{ row_id: 3, name: "Third", stackSize: 1 }]),
      );
    const onProgress = vi.fn();

    await fetchMarketBoardItems("541c0c12e07da325", onProgress);

    expect(onProgress.mock.calls).toEqual([[2], [3]]);
  });

  it("should leave out items with no name", async () => {
    mockedFetch.mockResolvedValue(
      itemsPage([
        { row_id: 1, name: "", stackSize: 1 },
        { row_id: 6141, name: "Cordial", stackSize: 999 },
      ]),
    );

    const items = await fetchMarketBoardItems("541c0c12e07da325");

    expect(items.map((item) => item.itemId)).toEqual([6141]);
  });

  it("should fail when XIVAPI doesn't answer successfully", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchMarketBoardItems("541c0c12e07da325")).rejects.toThrow(
      "XIVAPI market board item search failed (500)",
    );
  });
});

describe("fetchItemSummaries", () => {
  const summaryRows = (
    rows: { row_id: number; description: string; type?: string }[],
  ) =>
    new Response(
      JSON.stringify({
        rows: rows.map(({ row_id, description, type }) => ({
          row_id,
          fields: {
            Description: description,
            ItemUICategory: { fields: { Name: type ?? "" } },
          },
        })),
      }),
    );

  it("should give what each item is, and what the game says about it", async () => {
    mockedFetch.mockResolvedValue(
      summaryRows([
        {
          row_id: 6141,
          description: "A sweet, fermented concoction.",
          type: "Medicine",
        },
      ]),
    );

    expect(await fetchItemSummaries([6141])).toEqual(
      new Map([
        [
          6141,
          { type: "Medicine", description: "A sweet, fermented concoction." },
        ],
      ]),
    );
    const url = new URL(String(mockedFetch.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/sheet/Item");
    expect(url.searchParams.get("rows")).toBe("6141");
    expect(url.searchParams.get("fields")).toBe(
      "Description,ItemUICategory.Name",
    );
  });

  it("should give no type for an item that has none", async () => {
    mockedFetch.mockResolvedValue(
      summaryRows([{ row_id: 6141, description: "" }]),
    );

    expect(await fetchItemSummaries([6141])).toEqual(
      new Map([[6141, { type: undefined, description: "" }]]),
    );
  });

  it("should ask in batches of 100, since XIVAPI gives no more than that at once", async () => {
    mockedFetch.mockImplementation(async () => summaryRows([]));

    await fetchItemSummaries(Array.from({ length: 150 }, (_, i) => i + 1));

    expect(
      mockedFetch.mock.calls.map(
        ([url]) =>
          new URL(String(url)).searchParams.get("rows")!.split(",").length,
      ),
    ).toEqual([100, 50]);
  });

  it("should ask for nothing when given no items", async () => {
    expect(await fetchItemSummaries([])).toEqual(new Map());
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("should fail when XIVAPI doesn't answer successfully", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchItemSummaries([6141])).rejects.toThrow(
      "XIVAPI item-summary request failed (500)",
    );
  });
});

describe("fetchItemTypeNames", () => {
  const typesPage = (rows: [typeId: number, name: string][]) =>
    new Response(
      JSON.stringify({
        rows: rows.map(([row_id, Name]) => ({ row_id, fields: { Name } })),
      }),
    );

  const requestedTypeUrls = () =>
    mockedFetch.mock.calls.map(([url]) => new URL(String(url)));

  it("should give the name of each kind of thing an item can be", async () => {
    mockedFetch
      .mockResolvedValueOnce(
        typesPage([
          [44, "Medicine"],
          [98, "Scholar's Arm"],
        ]),
      )
      .mockResolvedValueOnce(typesPage([]));

    expect(await fetchItemTypeNames("541c0c12e07da325")).toEqual(
      new Map([
        [44, "Medicine"],
        [98, "Scholar's Arm"],
      ]),
    );
    const [url] = requestedTypeUrls();
    expect(url.pathname).toBe("/api/sheet/ItemUICategory");
    expect(url.searchParams.get("fields")).toBe("Name");
    expect(url.searchParams.get("version")).toBe("541c0c12e07da325");
  });

  it("should leave out kinds with no name", async () => {
    mockedFetch
      .mockResolvedValueOnce(
        typesPage([
          [0, ""],
          [44, "Medicine"],
        ]),
      )
      .mockResolvedValueOnce(typesPage([]));

    expect(await fetchItemTypeNames()).toEqual(new Map([[44, "Medicine"]]));
  });

  it("should carry on from the last of each page until a page comes back empty", async () => {
    mockedFetch
      .mockResolvedValueOnce(typesPage([[1, "One"]]))
      .mockResolvedValueOnce(typesPage([[2, "Two"]]))
      .mockResolvedValueOnce(typesPage([]));

    expect(await fetchItemTypeNames()).toEqual(
      new Map([
        [1, "One"],
        [2, "Two"],
      ]),
    );
    expect(
      requestedTypeUrls().map((url) => url.searchParams.get("after")),
    ).toEqual([null, "1", "2"]);
  });

  it("should fail when XIVAPI doesn't answer successfully", async () => {
    mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchItemTypeNames()).rejects.toThrow(
      "XIVAPI item-type request failed (500)",
    );
  });
});
