import { describe, expect, it } from "vitest";
import type {
  UniversalisHistoryEntry,
  UniversalisListing,
} from "../api/universalis";
import type { ConsistentPrice, RowAnalysis, SellListingStatus } from "../types";
import {
  buildReadyAnalysis,
  calculateAverageListingPrice,
  calculateAverageSalePrice,
  calculateConsistentPrice,
  determineSellListingStatus,
  isOwnRetainerListing,
  resolveSellTaxRate,
} from "./pricing";

const buildListing = (
  overrides: Partial<UniversalisListing> = {},
): UniversalisListing => {
  return {
    pricePerUnit: 100,
    quantity: 99,
    hq: false,
    retainerName: "Someone",
    ...overrides,
  };
};

const buildSaleEntry = (
  overrides: Partial<UniversalisHistoryEntry> = {},
): UniversalisHistoryEntry => {
  return {
    pricePerUnit: 100,
    quantity: 99,
    hq: false,
    timestamp: 0,
    ...overrides,
  };
};

/** Narrows a RowAnalysis to its "ready" shape, failing the test clearly if it isn't. */
const assertReady = (
  analysis: RowAnalysis,
): Extract<RowAnalysis, { status: "ready" }> => {
  if (analysis.status !== "ready") throw new Error("expected a ready analysis");
  return analysis;
};

describe("pricing", () => {
  describe("calculateConsistentPrice", () => {
    it("should have no price when there are no listings", () => {
      expect(calculateConsistentPrice([], 100)).toBeUndefined();
    });

    it("should price entirely off the cheapest listing when it alone covers the target quantity", () => {
      const result = calculateConsistentPrice(
        [buildListing({ pricePerUnit: 100, quantity: 99 })],
        50,
      );

      expect(result?.pricePerUnit).toBe(100);
      expect(result?.quantityFilled).toBe(50);
      expect(result?.fullyFilled).toBe(true);
    });

    it("should ignore pricier listings beyond what's needed to fill the target quantity", () => {
      const result = calculateConsistentPrice(
        [
          buildListing({ pricePerUnit: 900, quantity: 50 }),
          buildListing({ pricePerUnit: 200, quantity: 50 }),
          buildListing({ pricePerUnit: 100, quantity: 50 }),
        ],
        100,
      );

      expect(result?.pricePerUnit).toBe(150);
      expect(result?.quantityFilled).toBe(100);
    });

    it("should report a shortfall when the available listings can't reach the target quantity", () => {
      const result = calculateConsistentPrice(
        [buildListing({ pricePerUnit: 100, quantity: 10 })],
        100,
      );

      expect(result?.quantityFilled).toBe(10);
      expect(result?.fullyFilled).toBe(false);
    });

    it("should note the cheapest listing's world even when listings arrive unsorted", () => {
      const result = calculateConsistentPrice(
        [
          buildListing({ pricePerUnit: 300, worldName: "WorldC" }),
          buildListing({ pricePerUnit: 100, worldName: "WorldA" }),
          buildListing({ pricePerUnit: 200, worldName: "WorldB" }),
        ],
        50,
      );

      expect(result?.cheapestWorld).toBe("WorldA");
    });
  });

  describe("calculateAverageSalePrice", () => {
    it("should have no average when there is no sale history", () => {
      expect(calculateAverageSalePrice([], 3)).toBeUndefined();
    });

    it("should ignore sales older than the requested sample size", () => {
      const history = [
        buildSaleEntry({ pricePerUnit: 100, timestamp: 1 }),
        buildSaleEntry({ pricePerUnit: 200, timestamp: 2 }),
        buildSaleEntry({ pricePerUnit: 900, timestamp: 3 }),
      ];

      expect(calculateAverageSalePrice(history, 1)).toBe(900);
    });

    it("should average every sale there is when there are fewer than requested", () => {
      const history = [
        buildSaleEntry({ pricePerUnit: 100, timestamp: 1 }),
        buildSaleEntry({ pricePerUnit: 300, timestamp: 2 }),
      ];

      expect(calculateAverageSalePrice(history, 5)).toBe(200);
    });
  });

  describe("calculateAverageListingPrice", () => {
    it("should have no average when there are no listings", () => {
      expect(calculateAverageListingPrice([], 3)).toBeUndefined();
    });

    it("should average the cheapest currently-listed prices", () => {
      const listings = [
        buildListing({ pricePerUnit: 300 }),
        buildListing({ pricePerUnit: 100 }),
        buildListing({ pricePerUnit: 200 }),
      ];

      expect(calculateAverageListingPrice(listings, 2)).toBe(150);
    });

    it("should average every listing there is when there are fewer than requested", () => {
      const listings = [
        buildListing({ pricePerUnit: 100 }),
        buildListing({ pricePerUnit: 300 }),
      ];

      expect(calculateAverageListingPrice(listings, 5)).toBe(200);
    });
  });

  describe("isOwnRetainerListing", () => {
    it("should recognize a listing as our own when the world and retainer name both match", () => {
      const isOwn = isOwnRetainerListing(
        buildListing({ worldName: "WorldA", retainerName: "RetainerA" }),
        [{ name: "RetainerA", world: "WorldA" }],
      );

      expect(isOwn).toBe(true);
    });

    it("should not recognize a listing as our own when the retainer name matches but the world doesn't", () => {
      const isOwn = isOwnRetainerListing(
        buildListing({ worldName: "WorldB", retainerName: "RetainerA" }),
        [{ name: "RetainerA", world: "WorldA" }],
      );

      expect(isOwn).toBe(false);
    });

    it("should not recognize a listing as our own when the world matches but the retainer name doesn't", () => {
      const isOwn = isOwnRetainerListing(
        buildListing({ worldName: "WorldA", retainerName: "SomeoneElse" }),
        [{ name: "RetainerA", world: "WorldA" }],
      );

      expect(isOwn).toBe(false);
    });

    it("should not recognize a listing as our own when it doesn't say which world it's on", () => {
      const isOwn = isOwnRetainerListing(
        buildListing({ worldName: undefined, retainerName: "RetainerA" }),
        [{ name: "RetainerA", world: "WorldA" }],
      );

      expect(isOwn).toBe(false);
    });

    it("should not recognize any listing as our own when we have no retainers to compare against", () => {
      const isOwn = isOwnRetainerListing(
        buildListing({ worldName: "WorldA", retainerName: "RetainerA" }),
        [],
      );

      expect(isOwn).toBe(false);
    });
  });

  describe("determineSellListingStatus", () => {
    const ownRetainers = [{ name: "RetainerA", world: "WorldA" }];

    it("should report no listing when none of the current listings are ours", () => {
      const status = determineSellListingStatus(
        [buildListing({ pricePerUnit: 100, worldName: "WorldA" })],
        ownRetainers,
        5,
        10,
      );

      expect(status.state).toBe("not-listed");
    });

    it("should still be competitive when our listing ranks exactly at the threshold", () => {
      const listings = [
        buildListing({
          pricePerUnit: 100,
          worldName: "WorldA",
          retainerName: "A",
        }),
        buildListing({
          pricePerUnit: 110,
          worldName: "WorldA",
          retainerName: "B",
        }),
        buildListing({
          pricePerUnit: 120,
          worldName: "WorldA",
          retainerName: "RetainerA",
        }),
      ];

      const status = determineSellListingStatus(listings, ownRetainers, 3, 10);

      expect(status).toEqual({ state: "competitive", rank: 3 });
    });

    it("should be undercut when our listing isn't among the cheapest N, listing the cheapest with who posted them", () => {
      const listings = [
        buildListing({
          pricePerUnit: 110,
          worldName: "WorldA",
          retainerName: "B",
        }),
        buildListing({
          pricePerUnit: 500,
          worldName: "WorldA",
          retainerName: "RetainerA",
        }),
        buildListing({
          pricePerUnit: 100,
          worldName: "WorldA",
          retainerName: "A",
        }),
      ];

      const status = determineSellListingStatus(listings, ownRetainers, 2, 10);

      expect(status).toEqual({
        state: "undercut",
        ourPricePerUnit: 500,
        rank: 3,
        cheapestListings: [
          { pricePerUnit: 100, quantity: 99, retainerName: "A", ours: false },
          { pricePerUnit: 110, quantity: 99, retainerName: "B", ours: false },
          {
            pricePerUnit: 500,
            quantity: 99,
            retainerName: "RetainerA",
            ours: true,
          },
        ],
      });
    });

    it("should list only as many of the cheapest listings as are to be shown", () => {
      const listings = [100, 110, 120, 130].map((pricePerUnit) =>
        buildListing({
          pricePerUnit,
          worldName: "WorldA",
          retainerName: "Other",
        }),
      );
      listings.push(
        buildListing({
          pricePerUnit: 500,
          worldName: "WorldA",
          retainerName: "RetainerA",
        }),
      );

      const status = determineSellListingStatus(listings, ownRetainers, 1, 3);

      expect(
        status.state === "undercut" &&
          status.cheapestListings.map((listing) => listing.pricePerUnit),
      ).toEqual([100, 110, 120]);
    });

    it("should rank us by our cheapest listing when we have more than one", () => {
      const listings = [
        buildListing({
          pricePerUnit: 100,
          worldName: "WorldA",
          retainerName: "Other",
        }),
        buildListing({
          pricePerUnit: 120,
          worldName: "WorldA",
          retainerName: "RetainerA",
        }),
        buildListing({
          pricePerUnit: 900,
          worldName: "WorldA",
          retainerName: "RetainerA",
        }),
      ];

      const status = determineSellListingStatus(listings, ownRetainers, 5, 10);

      expect(status).toEqual({ state: "competitive", rank: 2 });
    });

    it("should mark each of our own listings among the cheapest as ours", () => {
      const listings = [
        buildListing({
          pricePerUnit: 100,
          worldName: "WorldA",
          retainerName: "Other",
        }),
        buildListing({
          pricePerUnit: 200,
          worldName: "WorldA",
          retainerName: "RetainerA",
        }),
        buildListing({
          pricePerUnit: 900,
          worldName: "WorldA",
          retainerName: "RetainerA",
        }),
      ];

      const status = determineSellListingStatus(listings, ownRetainers, 1, 10);

      expect(
        status.state === "undercut" &&
          status.cheapestListings.map((listing) => listing.ours),
      ).toEqual([false, true, true]);
    });
  });

  describe("resolveSellTaxRate", () => {
    it("should use the default rate when none of the retainers' cities have a known tax rate", () => {
      expect(
        resolveSellTaxRate(
          [{ id: "retainer-a", name: "RetainerA", city: "Nowhere" }],
          { "Ul'dah": 5 },
          0.05,
        ),
      ).toBe(0.05);
    });

    it("should use a retainer's own city tax rate when only one retainer is given", () => {
      expect(
        resolveSellTaxRate(
          [{ id: "retainer-a", name: "RetainerA", city: "Kugane" }],
          { Kugane: 0 },
          0.05,
        ),
      ).toBe(0);
    });

    it("should use the lowest tax rate among multiple retainers", () => {
      const retainers = [
        { id: "retainer-a", name: "RetainerA", city: "Ul'dah" },
        { id: "retainer-b", name: "RetainerB", city: "Kugane" },
      ];

      expect(
        resolveSellTaxRate(retainers, { "Ul'dah": 5, Kugane: 3 }, 0.05),
      ).toBe(0.03);
    });
  });

  describe("buildReadyAnalysis", () => {
    const buy: ConsistentPrice = {
      pricePerUnit: 100,
      quantityFilled: 297,
      fullyFilled: true,
      cheapestWorld: "WorldA",
    };
    const noTax = {
      buyTaxRate: 0,
      sellTaxRate: 0,
      gapThresholdMultiplier: 1.1,
    };
    const someVelocity = 10; // arbitrary non-zero placeholder for tests not concerned with throughput
    const notListed: SellListingStatus = { state: "not-listed" }; // placeholder for tests not concerned with our own listing's standing

    describe("choosing which price to sell at", () => {
      it("should sell at the current listing price when it sits well above recent sales", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            100,
            200,
            99,
            undefined,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.sellPriceSource).toBe("listings");
        expect(analysis.sellPricePerUnit).toBe(200);
        expect(analysis.gapDetected).toBe(true);
      });

      it("should not treat listings exactly at the gap threshold as a gap", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            100,
            150,
            99,
            undefined,
            someVelocity,
            { ...noTax, gapThresholdMultiplier: 1.5 },
            notListed,
          ),
        );

        expect(analysis.gapDetected).toBe(false);
        expect(analysis.sellPriceSource).toBe("history");
        expect(analysis.sellPricePerUnit).toBe(100);
      });

      it("should fall back to the current listing price when there is no sale history", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            undefined,
            150,
            99,
            undefined,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.sellPriceSource).toBe("listings");
        expect(analysis.sellPricePerUnit).toBe(150);
        expect(analysis.gapDetected).toBe(false);
      });

      it("should have no sell price when neither sale history nor current listings are available", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            undefined,
            undefined,
            99,
            undefined,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.sellPricePerUnit).toBeUndefined();
        expect(analysis.sellPriceSource).toBeUndefined();
      });
    });

    describe("capping the sell price", () => {
      it("should cap the sell price at the item's ceiling when the market price exceeds it", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            100,
            10_000,
            99,
            6000,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.sellPricePerUnit).toBe(6000);
        expect(analysis.sellPriceCapped).toBe(true);
      });

      it("should not cap the sell price when it exactly equals the ceiling", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            6000,
            undefined,
            99,
            6000,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.sellPricePerUnit).toBe(6000);
        expect(analysis.sellPriceCapped).toBe(false);
      });

      it("should deduct the sell tax from the capped price rather than the market price", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            10_000,
            undefined,
            99,
            6000,
            someVelocity,
            { ...noTax, sellTaxRate: 0.1 },
            notListed,
          ),
        );

        expect(analysis.effectiveSellPricePerUnit).toBeCloseTo(5400);
      });
    });

    describe("computing profit", () => {
      it("should add the buy tax rate on top of the buy price", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            200,
            undefined,
            99,
            undefined,
            someVelocity,
            {
              buyTaxRate: 0.1,
              sellTaxRate: 0,
              gapThresholdMultiplier: 1.1,
            },
            notListed,
          ),
        );

        expect(analysis.effectiveBuyPricePerUnit).toBeCloseTo(110);
      });

      it("should have no profit when there is no buy price", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            undefined,
            200,
            undefined,
            99,
            undefined,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.profitPerItem).toBeUndefined();
        expect(analysis.profitPerStack).toBeUndefined();
      });

      it("should have no profit when there is no sell price", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            undefined,
            undefined,
            99,
            undefined,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.profitPerItem).toBeUndefined();
        expect(analysis.profitPerStack).toBeUndefined();
      });

      it("should scale profit per stack by the item's stack size", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            200,
            undefined,
            50,
            undefined,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.profitPerItem).toBe(100);
        expect(analysis.profitPerStack).toBe(5000);
      });

      it("should count profit per stack over a market board stack, not an inventory stack", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            200,
            undefined,
            999,
            undefined,
            someVelocity,
            noTax,
            notListed,
          ),
        );

        expect(analysis.profitPerStack).toBe(9900);
      });
    });

    describe("accounting for market throughput", () => {
      it("should scale expected daily profit by how many units actually sell per day", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            200,
            undefined,
            99,
            undefined,
            5,
            noTax,
            notListed,
          ),
        );

        // profitPerItem is 100 (200 sell - 100 buy, no tax); at 5 sold/day that's 500/day.
        expect(analysis.profitPerItem).toBe(100);
        expect(analysis.expectedProfitPerDay).toBe(500);
      });

      it("should have zero expected daily profit when nothing has actually sold recently, even with a healthy per-item margin", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            200,
            undefined,
            99,
            undefined,
            0,
            noTax,
            notListed,
          ),
        );

        expect(analysis.profitPerItem).toBe(100);
        expect(analysis.expectedProfitPerDay).toBe(0);
      });

      it("should report the sale velocity it used even when there's no profit per item to scale", () => {
        const analysis = assertReady(
          buildReadyAnalysis(
            "Chaos",
            buy,
            undefined,
            undefined,
            99,
            undefined,
            5,
            noTax,
            notListed,
          ),
        );

        expect(analysis.expectedProfitPerDay).toBeUndefined();
        expect(analysis.saleVelocityPerDay).toBe(5);
      });
    });
  });
});
