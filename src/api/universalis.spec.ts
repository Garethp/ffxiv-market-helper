import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Grants every request straight away, so these tests are only about what's requested and returned.
vi.mock("../requestLimiting/CrossTabRequestLimiter", () => ({
  CrossTabRequestLimiter: class {
    async acquire() {
      return () => {};
    }
  },
}));

import { buildMarketPageUrl, fetchRegionListings } from "./universalis";

const mockedFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockedFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockedFetch.mockReset();
});

describe("buildMarketPageUrl", () => {
  it("should link to the item's market page scoped to the given world or data center", () => {
    expect(buildMarketPageUrl(12345, "Chaos")).toBe(
      "https://universalis.app/market/12345?server=Chaos",
    );
  });
});

describe("fetchRegionListings", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body));

  const requestedUrl = () => {
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    return new URL(String(mockedFetch.mock.calls[0][0]));
  };

  describe("for several items", () => {
    it("should ask the region for every listing of each item, with only their price and world and no sale history", async () => {
      mockedFetch.mockResolvedValue(json({ items: {} }));

      await fetchRegionListings("Europe", [8455, 1609]);

      const url = requestedUrl();
      expect(url.pathname).toBe("/api/v2/Europe/8455,1609");
      expect(url.searchParams.has("listings")).toBe(false);
      expect(url.searchParams.get("entries")).toBe("0");
      expect(url.searchParams.get("fields")).toBe(
        "items.listings.pricePerUnit,items.listings.worldName",
      );
    });

    it("should give each item's listings in the order given, leaving out items with none", async () => {
      const listings = [
        { pricePerUnit: 100, worldName: "Zodiark" },
        { pricePerUnit: 150, worldName: "Omega" },
      ];
      mockedFetch.mockResolvedValue(
        json({ items: { "8455": { listings }, "1609": { listings: [] } } }),
      );

      expect(await fetchRegionListings("Europe", [8455, 1609, 1])).toEqual(
        new Map([[8455, listings]]),
      );
    });
  });

  describe("for a single item", () => {
    it("should ask for the listing fields of a single-item response", async () => {
      mockedFetch.mockResolvedValue(json({ listings: [] }));

      await fetchRegionListings("Europe", [8455]);

      const url = requestedUrl();
      expect(url.pathname).toBe("/api/v2/Europe/8455");
      expect(url.searchParams.get("fields")).toBe(
        "listings.pricePerUnit,listings.worldName",
      );
    });

    it("should give the item's listings", async () => {
      const listings = [
        { pricePerUnit: 100, worldName: "Zodiark" },
        { pricePerUnit: 150, worldName: "Omega" },
      ];
      mockedFetch.mockResolvedValue(json({ listings }));

      expect(await fetchRegionListings("Europe", [8455])).toEqual(
        new Map([[8455, listings]]),
      );
    });

    it("should give nothing for an item with no listings", async () => {
      mockedFetch.mockResolvedValue(json({ listings: [] }));

      expect(await fetchRegionListings("Europe", [8455])).toEqual(new Map());
    });

    it("should give nothing for an item Universalis doesn't know", async () => {
      mockedFetch.mockResolvedValue(new Response("", { status: 404 }));

      expect(await fetchRegionListings("Europe", [1])).toEqual(new Map());
    });

    it("should fail when Universalis doesn't answer successfully", async () => {
      mockedFetch.mockResolvedValue(new Response("", { status: 500 }));

      await expect(fetchRegionListings("Europe", [8455])).rejects.toThrow(
        "Universalis region-listings request failed (500) for 1 items in Europe",
      );
    });
  });

  it("should ask for North America by the name Universalis gives it", async () => {
    mockedFetch.mockResolvedValue(json({ items: {} }));

    await fetchRegionListings("North America", [1, 2]);

    expect(requestedUrl().pathname).toBe("/api/v2/North-America/1,2");
  });

  it("should ask for nothing when given no items", async () => {
    expect(await fetchRegionListings("Europe", [])).toEqual(new Map());
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("should refuse more items than Universalis takes in one request", async () => {
    const itemIds = Array.from({ length: 101 }, (_, i) => i + 1);

    await expect(fetchRegionListings("Europe", itemIds)).rejects.toThrow(
      "Cannot request more than 100 items",
    );
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("should let the request be cancelled", async () => {
    mockedFetch.mockResolvedValue(json({ items: {} }));
    const controller = new AbortController();

    await fetchRegionListings("Europe", [1, 2], {
      signal: controller.signal,
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
