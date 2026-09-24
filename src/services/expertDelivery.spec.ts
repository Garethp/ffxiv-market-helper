import { describe, expect, it } from "vitest";
import type { RegionListing } from "../api/universalis";
import type { RegionInfo } from "../types";
import {
  calculateAverageSealsPerGil,
  planRoute,
  countSealsAt,
  calculateSealsPerGil,
  selectExpertDeliveryItems,
  selectItemsToBuy,
  type BuyingFilters,
  type ExpertDeliveryItem,
  type ExpertDeliveryPrice,
  type ItemToBuy,
} from "./expertDelivery";
const sealsByItemLevel = new Map([
  [50, 100],
  [60, 150],
  [90, 518],
  [100, 600],
]);

describe("Expert Delivery planning", () => {
  describe("selectExpertDeliveryItems", () => {
    it("should give each item the seals it hands in for, by its item level", () => {
      expect(
        selectExpertDeliveryItems(
          [{ itemId: 8455, name: "Augmented Wolfram Cuirass", itemLevel: 90 }],
          sealsByItemLevel,
          0,
        ),
      ).toEqual([
        {
          itemId: 8455,
          name: "Augmented Wolfram Cuirass",
          itemLevel: 90,
          seals: 518,
        },
      ]);
    });

    it("should list items fewest seals first", () => {
      const items = selectExpertDeliveryItems(
        [
          { itemId: 1, name: "Most", itemLevel: 100 },
          { itemId: 2, name: "Fewest", itemLevel: 60 },
          { itemId: 3, name: "Middle", itemLevel: 90 },
        ],
        sealsByItemLevel,
        0,
      );

      expect(items.map((item) => item.name)).toEqual([
        "Fewest",
        "Middle",
        "Most",
      ]);
    });

    it("should list items worth the same seals by name", () => {
      const items = selectExpertDeliveryItems(
        [
          { itemId: 1, name: "Wolfram Cuirass", itemLevel: 90 },
          { itemId: 2, name: "Augmented Wolfram Cuirass", itemLevel: 90 },
        ],
        sealsByItemLevel,
        0,
      );

      expect(items.map((item) => item.name)).toEqual([
        "Augmented Wolfram Cuirass",
        "Wolfram Cuirass",
      ]);
    });

    it("should leave out items worth fewer seals than the minimum, but keep those worth exactly the minimum", () => {
      const items = selectExpertDeliveryItems(
        [
          { itemId: 1, name: "Below", itemLevel: 50 },
          { itemId: 2, name: "Exactly", itemLevel: 60 },
          { itemId: 3, name: "Above", itemLevel: 90 },
        ],
        sealsByItemLevel,
        150,
      );

      expect(items.map((item) => item.name)).toEqual(["Exactly", "Above"]);
    });

    it("should leave out items whose item level has no seal value", () => {
      const items = selectExpertDeliveryItems(
        [
          { itemId: 1, name: "Unknown", itemLevel: 999 },
          { itemId: 2, name: "Known", itemLevel: 90 },
        ],
        sealsByItemLevel,
        0,
      );

      expect(items.map((item) => item.name)).toEqual(["Known"]);
    });
  });

  const buildItem = (
    itemId: number,
    seals: number,
    name = `Item ${itemId}`,
  ): ExpertDeliveryItem => ({ itemId, name, itemLevel: 100, seals });

  const buildListing = (
    pricePerUnit: number,
    worldName = "Zodiark",
  ): RegionListing => ({
    pricePerUnit,
    worldName,
  });

  const buildListedPrice = (
    ...listings: RegionListing[]
  ): ExpertDeliveryPrice => ({
    status: "listed",
    listings,
  });

  describe("calculateSealsPerGil", () => {
    it("should divide the item's seals by the listing's price", () => {
      expect(
        calculateSealsPerGil(buildItem(1, 518), buildListing(100)),
      ).toBeCloseTo(5.18);
    });
  });

  describe("selectItemsToBuy", () => {
    const getSelectedNames = (
      items: ExpertDeliveryItem[],
      prices: Record<number, ExpertDeliveryPrice>,
      filters: BuyingFilters = {},
    ) => selectItemsToBuy(items, prices, filters).map(({ item }) => item.name);

    describe("the listings", () => {
      it("should keep an item's listings, most seals per gil first", () => {
        const sword = buildItem(1, 500);

        expect(
          selectItemsToBuy(
            [sword],
            {
              1: buildListedPrice(
                buildListing(200, "Omega"),
                buildListing(100),
                buildListing(150, "Lich"),
              ),
            },
            {},
          ),
        ).toEqual([
          {
            item: sword,
            listings: [
              buildListing(100),
              buildListing(150, "Lich"),
              buildListing(200, "Omega"),
            ],
          },
        ]);
      });

      it("should keep only listings worth at least the minimum seals per gil, including exactly the minimum", () => {
        const [selected] = selectItemsToBuy(
          [buildItem(1, 250)],
          {
            1: buildListedPrice(
              buildListing(99),
              buildListing(100),
              buildListing(101),
            ),
          },
          { minimumSealsPerGil: 2.5 },
        );

        expect(selected.listings).toEqual([
          buildListing(99),
          buildListing(100),
        ]);
      });

      it("should keep only listings priced at most the maximum, including exactly the maximum", () => {
        const [selected] = selectItemsToBuy(
          [buildItem(1, 500)],
          {
            1: buildListedPrice(
              buildListing(999),
              buildListing(1000),
              buildListing(1001),
            ),
          },
          { maximumPricePerUnit: 1000 },
        );

        expect(selected.listings).toEqual([
          buildListing(999),
          buildListing(1000),
        ]);
      });
    });

    describe("the items", () => {
      it("should leave out items with no listings inside the filters", () => {
        expect(
          getSelectedNames(
            [
              buildItem(1, 100, "Too few seals per gil"),
              buildItem(2, 1000, "Fine"),
            ],
            {
              1: buildListedPrice(buildListing(100)),
              2: buildListedPrice(buildListing(100)),
            },
            { minimumSealsPerGil: 2.5 },
          ),
        ).toEqual(["Fine"]);
      });

      it("should leave out items not priced yet, with no listings, or whose prices couldn't be fetched", () => {
        expect(
          getSelectedNames(
            [buildItem(1, 100), buildItem(2, 100), buildItem(3, 100)],
            {
              2: { status: "unlisted" },
              3: { status: "failed" },
            },
          ),
        ).toEqual([]);
      });

      it("should put the items with the most seals per gil from their best listing first", () => {
        expect(
          getSelectedNames(
            [
              buildItem(1, 200, "Two per gil"),
              buildItem(2, 500, "Five per gil"),
              buildItem(3, 300, "Three per gil"),
            ],
            {
              1: buildListedPrice(buildListing(100)),
              // Its pricier listing doesn't drag it down.
              2: buildListedPrice(buildListing(100), buildListing(10_000)),
              3: buildListedPrice(buildListing(100)),
            },
          ),
        ).toEqual(["Five per gil", "Three per gil", "Two per gil"]);
      });

      it("should put items worth the same seals per gil fewest seals first, then by name", () => {
        expect(
          getSelectedNames(
            [
              buildItem(1, 400, "Pricier"),
              buildItem(2, 200, "Beta"),
              buildItem(3, 200, "Alpha"),
            ],
            {
              1: buildListedPrice(buildListing(200)),
              2: buildListedPrice(buildListing(100)),
              3: buildListedPrice(buildListing(100)),
            },
          ),
        ).toEqual(["Alpha", "Beta", "Pricier"]);
      });
    });
  });

  describe("calculateAverageSealsPerGil", () => {
    it("should average the seals per gil of the item's listings", () => {
      expect(
        calculateAverageSealsPerGil({
          item: buildItem(1, 600),
          listings: [buildListing(100), buildListing(300)],
        }),
      ).toBeCloseTo(4);
    });
  });

  describe("planRoute", () => {
    const regions: RegionInfo[] = [
      {
        name: "Europe",
        dataCenters: [
          { name: "Light", worlds: ["Zodiark", "Lich", "Odin", "Phoenix"] },
          { name: "Chaos", worlds: ["Omega", "Cerberus", "Louisoix"] },
          { name: "Shadow", worlds: ["Innocence", "Pandaemonium"] },
        ],
      },
    ];

    /** Each leg's data center, and each of its stops' world with the names and prices of what's bought there. */
    const summarizeRoute = (itemsToBuy: ItemToBuy[], homeWorld = "Zodiark") =>
      planRoute(itemsToBuy, homeWorld, regions).map((leg) => ({
        dataCenter: leg.dataCenter,
        stops: leg.stops.map((stop) => ({
          world: stop.world,
          listings: stop.listings.map(
            ({ item, listing }) => `${item.name} @ ${listing.pricePerUnit}`,
          ),
        })),
      }));

    const buildItemToBuy = (
      itemToBuy: ExpertDeliveryItem,
      ...listings: RegionListing[]
    ): ItemToBuy => ({ item: itemToBuy, listings });

    it("should list each world's listings most seals per gil first, across items", () => {
      expect(
        summarizeRoute([
          buildItemToBuy(
            buildItem(1, 900, "Sword"),
            buildListing(100, "Lich"),
            buildListing(400, "Lich"),
          ),
          buildItemToBuy(
            buildItem(2, 500, "Shield"),
            buildListing(100, "Lich"),
          ),
        ])[0].stops[0].listings,
      ).toEqual(["Sword @ 100", "Shield @ 100", "Sword @ 400"]);
    });

    it("should list listings worth the same seals per gil fewest seals first, then by name", () => {
      expect(
        summarizeRoute([
          buildItemToBuy(
            buildItem(1, 400, "Pricier"),
            buildListing(200, "Lich"),
          ),
          buildItemToBuy(buildItem(2, 200, "Beta"), buildListing(100, "Lich")),
          buildItemToBuy(buildItem(3, 200, "Alpha"), buildListing(100, "Lich")),
        ])[0].stops[0].listings,
      ).toEqual(["Alpha @ 100", "Beta @ 100", "Pricier @ 200"]);
    });

    it("should visit the home world first, then the rest of its data center most seals first", () => {
      expect(
        summarizeRoute([
          buildItemToBuy(
            buildItem(1, 100, "At home"),
            buildListing(10, "Zodiark"),
          ),
          buildItemToBuy(
            buildItem(2, 300, "Cuirass"),
            buildListing(10, "Lich"),
            buildListing(10, "Odin"),
          ),
          buildItemToBuy(buildItem(3, 700, "Sword"), buildListing(10, "Odin")),
          buildItemToBuy(buildItem(4, 700, "Shield"), buildListing(10, "Lich")),
          buildItemToBuy(buildItem(5, 200, "Helm"), buildListing(10, "Lich")),
        ]).map((leg) => leg.stops.map((stop) => stop.world)),
      ).toEqual([["Zodiark", "Lich", "Odin"]]);
    });

    it("should visit worlds offering the same seals by name", () => {
      expect(
        summarizeRoute([
          buildItemToBuy(
            buildItem(1, 500, "On Phoenix"),
            buildListing(10, "Phoenix"),
          ),
          buildItemToBuy(
            buildItem(2, 500, "On Lich"),
            buildListing(10, "Lich"),
          ),
        ])[0].stops.map((stop) => stop.world),
      ).toEqual(["Lich", "Phoenix"]);
    });

    it("should visit the home data center before others, even when others offer more seals", () => {
      expect(
        summarizeRoute([
          buildItemToBuy(buildItem(1, 100), buildListing(10, "Lich")),
          buildItemToBuy(buildItem(2, 5000), buildListing(10, "Omega")),
        ]).map((leg) => leg.dataCenter),
      ).toEqual(["Light", "Chaos"]);
    });

    it("should visit other data centers most seals first, and their worlds most seals first", () => {
      expect(
        summarizeRoute([
          buildItemToBuy(
            buildItem(1, 800, "On Innocence"),
            buildListing(10, "Innocence"),
          ),
          buildItemToBuy(
            buildItem(2, 500, "On Omega"),
            buildListing(10, "Omega"),
          ),
          buildItemToBuy(
            buildItem(3, 600, "On Cerberus"),
            buildListing(10, "Cerberus"),
          ),
        ]),
      ).toEqual([
        {
          dataCenter: "Chaos",
          stops: [
            { world: "Cerberus", listings: ["On Cerberus @ 10"] },
            { world: "Omega", listings: ["On Omega @ 10"] },
          ],
        },
        {
          dataCenter: "Shadow",
          stops: [{ world: "Innocence", listings: ["On Innocence @ 10"] }],
        },
      ]);
    });

    it("should visit other data centers offering the same seals by name", () => {
      expect(
        summarizeRoute([
          buildItemToBuy(buildItem(1, 500), buildListing(10, "Innocence")),
          buildItemToBuy(buildItem(2, 500), buildListing(10, "Omega")),
        ]).map((leg) => leg.dataCenter),
      ).toEqual(["Chaos", "Shadow"]);
    });

    it("should visit worlds that aren't in the directory last", () => {
      expect(
        summarizeRoute([
          buildItemToBuy(
            buildItem(1, 5000, "Somewhere new"),
            buildListing(10, "Brand New World"),
          ),
          buildItemToBuy(
            buildItem(2, 100, "On Omega"),
            buildListing(10, "Omega"),
          ),
        ]),
      ).toEqual([
        {
          dataCenter: "Chaos",
          stops: [{ world: "Omega", listings: ["On Omega @ 10"] }],
        },
        {
          dataCenter: undefined,
          stops: [
            { world: "Brand New World", listings: ["Somewhere new @ 10"] },
          ],
        },
      ]);
    });
  });

  describe("countSealsAt", () => {
    it("should add up the seals of everything bought at a stop, counting an item listed twice twice", () => {
      const sword = buildItem(1, 500);

      expect(
        countSealsAt({
          world: "Zodiark",
          listings: [
            { item: sword, listing: buildListing(1) },
            { item: sword, listing: buildListing(2) },
            { item: buildItem(2, 300), listing: buildListing(1) },
          ],
        }),
      ).toBe(1300);
    });
  });
});
