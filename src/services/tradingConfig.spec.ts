import { describe, expect, it, vi } from "vitest";
import type { Character, RegionInfo, TradingParameters } from "../types";

vi.mock("./configService", () => ({
  configService: {
    getRegions: vi.fn(),
    getMarketBoardCities: vi.fn(),
    getTradingParameters: vi.fn(),
  },
}));

import {
  buildTradingConfig,
  deriveOwnRetainers,
  groupCharactersByRegion,
} from "./tradingConfig";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [{ name: "Light", worlds: ["WorldA"] }],
  },
  {
    name: "Japan",
    dataCenters: [{ name: "Elemental", worlds: ["WorldB"] }],
  },
];

const buildCharacter = (overrides: Partial<Character> = {}): Character => {
  return {
    id: "someone",
    name: "Someone",
    homeWorld: "WorldA",
    retainers: [],
    ...overrides,
  };
};

describe("trading config", () => {
  describe("groupCharactersByRegion", () => {
    it("should put characters in separate groups when they're based in different regions", () => {
      const alice = buildCharacter({
        id: "alice",
        name: "Alice",
        homeWorld: "WorldA",
      });
      const bob = buildCharacter({
        id: "bob",
        name: "Bob",
        homeWorld: "WorldB",
      });

      const groups = groupCharactersByRegion([alice, bob], regions);

      expect(groups).toEqual([
        {
          region: "Europe",
          characters: [{ id: "alice", name: "Alice", note: undefined }],
        },
        {
          region: "Japan",
          characters: [{ id: "bob", name: "Bob", note: undefined }],
        },
      ]);
    });

    it("should combine multiple characters based in the same region into one group", () => {
      const alice = buildCharacter({
        id: "alice",
        name: "Alice",
        homeWorld: "WorldA",
      });
      const second = buildCharacter({
        id: "second",
        name: "Second",
        homeWorld: "WorldA",
      });

      const groups = groupCharactersByRegion([alice, second], regions);

      expect(groups).toEqual([
        {
          region: "Europe",
          characters: [
            { id: "alice", name: "Alice", note: undefined },
            { id: "second", name: "Second", note: undefined },
          ],
        },
      ]);
    });

    it("should carry each character's note into its group", () => {
      const alice = buildCharacter({
        id: "alice",
        name: "Alice",
        homeWorld: "WorldA",
        note: "Needs a meetup to hand goods over",
      });
      const second = buildCharacter({
        id: "second",
        name: "Second",
        homeWorld: "WorldA",
      });

      const groups = groupCharactersByRegion([alice, second], regions);

      expect(groups).toEqual([
        {
          region: "Europe",
          characters: [
            {
              id: "alice",
              name: "Alice",
              note: "Needs a meetup to hand goods over",
            },
            { id: "second", name: "Second", note: undefined },
          ],
        },
      ]);
    });

    it("should fall back to an 'Unknown region' group for a world that isn't in the directory", () => {
      const groups = groupCharactersByRegion(
        [buildCharacter({ homeWorld: "Nowhereland" })],
        regions,
      );

      expect(groups).toEqual([
        {
          region: "Unknown region",
          characters: [{ id: "someone", name: "Someone", note: undefined }],
        },
      ]);
    });
  });

  describe("deriveOwnRetainers", () => {
    it("should pair each retainer with its owning character's home world", () => {
      const alice = buildCharacter({
        name: "Alice",
        homeWorld: "WorldA",
        retainers: [
          { id: "a", name: "RetainerA", city: "Ul'dah" },
          { id: "b", name: "RetainerB", city: "Ul'dah" },
        ],
      });

      expect(deriveOwnRetainers([alice])).toEqual([
        { name: "RetainerA", world: "WorldA" },
        { name: "RetainerB", world: "WorldA" },
      ]);
    });

    it("should pair retainers with each owning character's world across several characters", () => {
      const alice = buildCharacter({
        name: "Alice",
        homeWorld: "WorldA",
        retainers: [{ id: "a", name: "RetainerA", city: "Ul'dah" }],
      });
      const bob = buildCharacter({
        name: "Bob",
        homeWorld: "WorldB",
        retainers: [
          { id: "b", name: "RetainerB", city: "Kugane" },
          { id: "c", name: "RetainerC", city: "Kugane" },
        ],
      });

      expect(deriveOwnRetainers([alice, bob])).toEqual([
        { name: "RetainerA", world: "WorldA" },
        { name: "RetainerB", world: "WorldB" },
        { name: "RetainerC", world: "WorldB" },
      ]);
    });
  });

  describe("buildTradingConfig", () => {
    it("should add the roster and tracked items, with the buying regions and own retainers worked out from the roster", () => {
      const alice = buildCharacter({
        id: "alice",
        name: "Alice",
        homeWorld: "WorldA",
        retainers: [{ id: "a", name: "RetainerA", city: "Ul'dah" }],
      });
      const bob = buildCharacter({
        id: "bob",
        name: "Bob",
        homeWorld: "WorldB",
      });
      const trackedItems = [
        {
          id: "cordial",
          itemId: 6141,
          name: "Cordial",
          stackSize: 999,
          targetQuantity: 99,
        },
      ];
      const loaded = {
        regions,
        marketBoardCities: ["Ul'dah"],
        params: { refreshIntervalMs: 90_000 } as TradingParameters,
      };

      expect(buildTradingConfig(loaded, [alice, bob], trackedItems)).toEqual({
        ...loaded,
        characters: [alice, bob],
        trackedItems,
        buyingRegions: [
          {
            region: "Europe",
            characters: [{ id: "alice", name: "Alice", note: undefined }],
          },
          {
            region: "Japan",
            characters: [{ id: "bob", name: "Bob", note: undefined }],
          },
        ],
        ownRetainers: [{ name: "RetainerA", world: "WorldA" }],
      });
    });
  });
});
