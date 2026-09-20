import { describe, expect, it } from "vitest";
import type { RegionListing } from "../api/universalis";
import type { RegionInfo } from "../types";
import {
  averageSealsPerGil,
  planRoute,
  sealsAt,
  sealsPerGil,
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

const item = (
  itemId: number,
  seals: number,
  name = `Item ${itemId}`,
): ExpertDeliveryItem => ({ itemId, name, itemLevel: 100, seals });

const at = (pricePerUnit: number, worldName = "Zodiark"): RegionListing => ({
  pricePerUnit,
  worldName,
});

const listed = (...listings: RegionListing[]): ExpertDeliveryPrice => ({
  status: "listed",
  listings,
});

describe("sealsPerGil", () => {
  it("should divide the item's seals by the listing's price", () => {
    expect(sealsPerGil(item(1, 518), at(100))).toBeCloseTo(5.18);
  });
});

describe("selectItemsToBuy", () => {
  const namesSelected = (
    items: ExpertDeliveryItem[],
    prices: Record<number, ExpertDeliveryPrice>,
    filters: BuyingFilters = {},
  ) => selectItemsToBuy(items, prices, filters).map(({ item }) => item.name);

  describe("the listings", () => {
    it("should keep an item's listings, most seals per gil first", () => {
      const sword = item(1, 500);

      expect(
        selectItemsToBuy(
          [sword],
          { 1: listed(at(200, "Omega"), at(100), at(150, "Lich")) },
          {},
        ),
      ).toEqual([
        { item: sword, listings: [at(100), at(150, "Lich"), at(200, "Omega")] },
      ]);
    });

    it("should keep only listings worth at least the minimum seals per gil, including exactly the minimum", () => {
      const [selected] = selectItemsToBuy(
        [item(1, 250)],
        { 1: listed(at(99), at(100), at(101)) },
        { minimumSealsPerGil: 2.5 },
      );

      expect(selected.listings).toEqual([at(99), at(100)]);
    });

    it("should keep only listings priced at most the maximum, including exactly the maximum", () => {
      const [selected] = selectItemsToBuy(
        [item(1, 500)],
        { 1: listed(at(999), at(1000), at(1001)) },
        { maximumPricePerUnit: 1000 },
      );

      expect(selected.listings).toEqual([at(999), at(1000)]);
    });

    it("should keep every listing when no filters are set", () => {
      const [selected] = selectItemsToBuy(
        [item(1, 1)],
        { 1: listed(at(1), at(1_000_000)) },
        {},
      );

      expect(selected.listings).toEqual([at(1), at(1_000_000)]);
    });
  });

  describe("the items", () => {
    it("should leave out items with no listings inside the filters", () => {
      expect(
        namesSelected(
          [item(1, 100, "Too few seals per gil"), item(2, 1000, "Fine")],
          { 1: listed(at(100)), 2: listed(at(100)) },
          { minimumSealsPerGil: 2.5 },
        ),
      ).toEqual(["Fine"]);
    });

    it("should leave out items not priced yet, with no listings, or whose prices couldn't be fetched", () => {
      expect(
        namesSelected([item(1, 100), item(2, 100), item(3, 100)], {
          2: { status: "unlisted" },
          3: { status: "failed" },
        }),
      ).toEqual([]);
    });

    it("should put the items with the most seals per gil from their best listing first", () => {
      expect(
        namesSelected(
          [
            item(1, 200, "Two per gil"),
            item(2, 500, "Five per gil"),
            item(3, 300, "Three per gil"),
          ],
          {
            1: listed(at(100)),
            // Its pricier listing doesn't drag it down.
            2: listed(at(100), at(10_000)),
            3: listed(at(100)),
          },
        ),
      ).toEqual(["Five per gil", "Three per gil", "Two per gil"]);
    });

    it("should put items worth the same seals per gil fewest seals first, then by name", () => {
      expect(
        namesSelected(
          [
            item(1, 400, "Pricier"),
            item(2, 200, "Beta"),
            item(3, 200, "Alpha"),
          ],
          { 1: listed(at(200)), 2: listed(at(100)), 3: listed(at(100)) },
        ),
      ).toEqual(["Alpha", "Beta", "Pricier"]);
    });
  });
});

describe("averageSealsPerGil", () => {
  it("should average the seals per gil of the item's listings", () => {
    expect(
      averageSealsPerGil({ item: item(1, 600), listings: [at(100), at(300)] }),
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
  const routeOf = (itemsToBuy: ItemToBuy[], homeWorld = "Zodiark") =>
    planRoute(itemsToBuy, homeWorld, regions).map((leg) => ({
      dataCenter: leg.dataCenter,
      stops: leg.stops.map((stop) => ({
        world: stop.world,
        listings: stop.listings.map(
          ({ item, listing }) => `${item.name} @ ${listing.pricePerUnit}`,
        ),
      })),
    }));

  const toBuy = (
    itemToBuy: ExpertDeliveryItem,
    ...listings: RegionListing[]
  ): ItemToBuy => ({ item: itemToBuy, listings });

  it("should buy each listing on the world it's on, keeping it with its item", () => {
    const cuirass = item(1, 500, "Cuirass");

    expect(
      planRoute([toBuy(cuirass, at(150, "Lich"))], "Zodiark", regions),
    ).toEqual([
      {
        dataCenter: "Light",
        stops: [
          {
            world: "Lich",
            listings: [{ item: cuirass, listing: at(150, "Lich") }],
          },
        ],
      },
    ]);
  });

  it("should buy an item at every world it's listed on, and as many times as it's listed there", () => {
    expect(
      routeOf([
        toBuy(
          item(1, 500, "Cuirass"),
          at(100, "Lich"),
          at(120, "Odin"),
          at(130, "Lich"),
        ),
      ]),
    ).toEqual([
      {
        dataCenter: "Light",
        stops: [
          { world: "Lich", listings: ["Cuirass @ 100", "Cuirass @ 130"] },
          { world: "Odin", listings: ["Cuirass @ 120"] },
        ],
      },
    ]);
  });

  it("should list each world's listings most seals per gil first, across items", () => {
    expect(
      routeOf([
        toBuy(item(1, 900, "Sword"), at(100, "Lich"), at(400, "Lich")),
        toBuy(item(2, 500, "Shield"), at(100, "Lich")),
      ])[0].stops[0].listings,
    ).toEqual(["Sword @ 100", "Shield @ 100", "Sword @ 400"]);
  });

  it("should list listings worth the same seals per gil fewest seals first, then by name", () => {
    expect(
      routeOf([
        toBuy(item(1, 400, "Pricier"), at(200, "Lich")),
        toBuy(item(2, 200, "Beta"), at(100, "Lich")),
        toBuy(item(3, 200, "Alpha"), at(100, "Lich")),
      ])[0].stops[0].listings,
    ).toEqual(["Alpha @ 100", "Beta @ 100", "Pricier @ 200"]);
  });

  it("should visit the home world first, then the rest of its data center most seals first", () => {
    expect(
      routeOf([
        toBuy(item(1, 100, "At home"), at(10, "Zodiark")),
        toBuy(item(2, 300, "Cuirass"), at(10, "Lich"), at(10, "Odin")),
        toBuy(item(3, 700, "Sword"), at(10, "Odin")),
        toBuy(item(4, 700, "Shield"), at(10, "Lich")),
        toBuy(item(5, 200, "Helm"), at(10, "Lich")),
      ]).map((leg) => leg.stops.map((stop) => stop.world)),
    ).toEqual([["Zodiark", "Lich", "Odin"]]);
  });

  it("should visit worlds offering the same seals by name", () => {
    expect(
      routeOf([
        toBuy(item(1, 500, "On Phoenix"), at(10, "Phoenix")),
        toBuy(item(2, 500, "On Lich"), at(10, "Lich")),
      ])[0].stops.map((stop) => stop.world),
    ).toEqual(["Lich", "Phoenix"]);
  });

  it("should visit the home data center before others, even when others offer more seals", () => {
    expect(
      routeOf([
        toBuy(item(1, 100), at(10, "Lich")),
        toBuy(item(2, 5000), at(10, "Omega")),
      ]).map((leg) => leg.dataCenter),
    ).toEqual(["Light", "Chaos"]);
  });

  it("should visit other data centers most seals first, and their worlds most seals first", () => {
    expect(
      routeOf([
        toBuy(item(1, 800, "On Innocence"), at(10, "Innocence")),
        toBuy(item(2, 500, "On Omega"), at(10, "Omega")),
        toBuy(item(3, 600, "On Cerberus"), at(10, "Cerberus")),
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
      routeOf([
        toBuy(item(1, 500), at(10, "Innocence")),
        toBuy(item(2, 500), at(10, "Omega")),
      ]).map((leg) => leg.dataCenter),
    ).toEqual(["Chaos", "Shadow"]);
  });

  it("should visit worlds that aren't in the directory last", () => {
    expect(
      routeOf([
        toBuy(item(1, 5000, "Somewhere new"), at(10, "Brand New World")),
        toBuy(item(2, 100, "On Omega"), at(10, "Omega")),
      ]),
    ).toEqual([
      {
        dataCenter: "Chaos",
        stops: [{ world: "Omega", listings: ["On Omega @ 10"] }],
      },
      {
        dataCenter: undefined,
        stops: [{ world: "Brand New World", listings: ["Somewhere new @ 10"] }],
      },
    ]);
  });

  it("should plan nowhere when there's nothing to buy", () => {
    expect(routeOf([])).toEqual([]);
  });
});

describe("sealsAt", () => {
  it("should add up the seals of everything bought at a stop, counting an item listed twice twice", () => {
    const sword = item(1, 500);

    expect(
      sealsAt({
        world: "Zodiark",
        listings: [
          { item: sword, listing: at(1) },
          { item: sword, listing: at(2) },
          { item: item(2, 300), listing: at(1) },
        ],
      }),
    ).toBe(1300);
  });
});
