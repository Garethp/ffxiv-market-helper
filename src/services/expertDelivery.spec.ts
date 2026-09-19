import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/xivapi", () => ({
  fetchExpertDeliveryCandidates: vi.fn(),
  fetchExpertDeliverySealsByItemLevel: vi.fn(),
}));

import {
  fetchExpertDeliveryCandidates,
  fetchExpertDeliverySealsByItemLevel,
} from "../api/xivapi";
import {
  listExpertDeliveryItems,
  sealsPerGil,
  sortForBuying,
  type ExpertDeliveryItem,
  type ExpertDeliveryPrice,
} from "./expertDelivery";

const mockedFetchCandidates = vi.mocked(fetchExpertDeliveryCandidates);
const mockedFetchSeals = vi.mocked(fetchExpertDeliverySealsByItemLevel);

const sealsByItemLevel = new Map([
  [50, 100],
  [60, 150],
  [90, 518],
  [100, 600],
]);

afterEach(() => {
  vi.resetAllMocks();
});

describe("listExpertDeliveryItems", () => {
  it("should give each item the seals it hands in for, by its item level", async () => {
    mockedFetchCandidates.mockResolvedValue([
      { itemId: 8455, name: "Augmented Wolfram Cuirass", itemLevel: 90 },
    ]);
    mockedFetchSeals.mockResolvedValue(sealsByItemLevel);

    expect(await listExpertDeliveryItems(0)).toEqual([
      {
        itemId: 8455,
        name: "Augmented Wolfram Cuirass",
        itemLevel: 90,
        seals: 518,
      },
    ]);
  });

  it("should list items fewest seals first", async () => {
    mockedFetchCandidates.mockResolvedValue([
      { itemId: 1, name: "Most", itemLevel: 100 },
      { itemId: 2, name: "Fewest", itemLevel: 60 },
      { itemId: 3, name: "Middle", itemLevel: 90 },
    ]);
    mockedFetchSeals.mockResolvedValue(sealsByItemLevel);

    const items = await listExpertDeliveryItems(0);

    expect(items.map((item) => item.name)).toEqual([
      "Fewest",
      "Middle",
      "Most",
    ]);
  });

  it("should list items worth the same seals by name", async () => {
    mockedFetchCandidates.mockResolvedValue([
      { itemId: 1, name: "Wolfram Cuirass", itemLevel: 90 },
      { itemId: 2, name: "Augmented Wolfram Cuirass", itemLevel: 90 },
    ]);
    mockedFetchSeals.mockResolvedValue(sealsByItemLevel);

    const items = await listExpertDeliveryItems(0);

    expect(items.map((item) => item.name)).toEqual([
      "Augmented Wolfram Cuirass",
      "Wolfram Cuirass",
    ]);
  });

  it("should leave out items worth fewer seals than the minimum, but keep those worth exactly the minimum", async () => {
    mockedFetchCandidates.mockResolvedValue([
      { itemId: 1, name: "Below", itemLevel: 50 },
      { itemId: 2, name: "Exactly", itemLevel: 60 },
      { itemId: 3, name: "Above", itemLevel: 90 },
    ]);
    mockedFetchSeals.mockResolvedValue(sealsByItemLevel);

    const items = await listExpertDeliveryItems(150);

    expect(items.map((item) => item.name)).toEqual(["Exactly", "Above"]);
  });

  it("should leave out items whose item level has no seal value", async () => {
    mockedFetchCandidates.mockResolvedValue([
      { itemId: 1, name: "Unknown", itemLevel: 999 },
      { itemId: 2, name: "Known", itemLevel: 90 },
    ]);
    mockedFetchSeals.mockResolvedValue(sealsByItemLevel);

    const items = await listExpertDeliveryItems(0);

    expect(items.map((item) => item.name)).toEqual(["Known"]);
  });

  it("should fail when either the items or the seal values can't be fetched", async () => {
    mockedFetchCandidates.mockResolvedValue([]);
    mockedFetchSeals.mockRejectedValue(new Error("XIVAPI is down"));

    await expect(listExpertDeliveryItems(0)).rejects.toThrow("XIVAPI is down");
  });
});

const item = (
  itemId: number,
  seals: number,
  name = `Item ${itemId}`,
): ExpertDeliveryItem => ({ itemId, name, itemLevel: 100, seals });

const listedAt = (pricePerUnit: number): ExpertDeliveryPrice => ({
  status: "listed",
  listing: { pricePerUnit, worldName: "Zodiark" },
});

describe("sealsPerGil", () => {
  it("should divide the item's seals by the listing's price", () => {
    const listing = { pricePerUnit: 100, worldName: "Zodiark" };

    expect(sealsPerGil(item(1, 518), listing)).toBeCloseTo(5.18);
  });
});

describe("sortForBuying", () => {
  const namesInOrder = (
    items: ExpertDeliveryItem[],
    prices: Record<number, ExpertDeliveryPrice>,
  ) => sortForBuying(items, prices).map((sorted) => sorted.name);

  it("should put listed items first, most seals per gil first", () => {
    const items = [
      item(1, 200, "Two per gil"),
      item(2, 500, "Five per gil"),
      item(3, 300, "Three per gil"),
    ];

    expect(
      namesInOrder(items, {
        1: listedAt(100),
        2: listedAt(100),
        3: listedAt(100),
      }),
    ).toEqual(["Five per gil", "Three per gil", "Two per gil"]);
  });

  it("should put listed items worth the same seals per gil fewest seals first, then by name", () => {
    const items = [
      item(1, 400, "Pricier"),
      item(2, 200, "Beta"),
      item(3, 200, "Alpha"),
    ];

    expect(
      namesInOrder(items, {
        1: listedAt(200),
        2: listedAt(100),
        3: listedAt(100),
      }),
    ).toEqual(["Alpha", "Beta", "Pricier"]);
  });

  it("should put items not priced yet after listed ones, fewest seals first", () => {
    const items = [
      item(1, 900, "Unpriced, more seals"),
      item(2, 100, "Listed"),
      item(3, 300, "Unpriced, fewer seals"),
    ];

    expect(namesInOrder(items, { 2: listedAt(1_000_000) })).toEqual([
      "Listed",
      "Unpriced, fewer seals",
      "Unpriced, more seals",
    ]);
  });

  it("should put items with no listings, or whose prices couldn't be fetched, last, fewest seals first", () => {
    const items = [
      item(1, 900, "Unlisted"),
      item(2, 1000, "Unpriced"),
      item(3, 300, "Failed"),
      item(4, 100, "Listed"),
    ];

    expect(
      namesInOrder(items, {
        1: { status: "unlisted" },
        3: { status: "failed" },
        4: listedAt(100),
      }),
    ).toEqual(["Listed", "Unpriced", "Failed", "Unlisted"]);
  });

  it("should leave the items it was given in their order", () => {
    const items = [item(1, 200), item(2, 500)];

    sortForBuying(items, { 1: listedAt(100), 2: listedAt(100) });

    expect(items.map((sorted) => sorted.itemId)).toEqual([1, 2]);
  });
});
