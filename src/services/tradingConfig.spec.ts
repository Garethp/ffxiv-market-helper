import { describe, expect, it, vi } from "vitest";
import type { Character, RegionInfo, TradingParameters } from "../types";

vi.mock("./configService", () => ({
  configService: {
    getCharacters: vi.fn(),
    getRegions: vi.fn(),
    getTradingParameters: vi.fn(),
    getDefaultCharacterName: vi.fn(),
  },
}));

import { configService } from "./configService";
import {
  deriveOwnRetainers,
  groupCharactersByRegion,
  loadTradingConfig,
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

const character = (overrides: Partial<Character> = {}): Character => {
  return {
    name: "Someone",
    homeWorld: "WorldA",
    retainers: [],
    ...overrides,
  };
};

describe("groupCharactersByRegion", () => {
  it("should put characters in separate groups when they're based in different regions", () => {
    const alice = character({ name: "Alice", homeWorld: "WorldA" });
    const bob = character({ name: "Bob", homeWorld: "WorldB" });

    const groups = groupCharactersByRegion([alice, bob], regions);

    expect(groups).toEqual([
      { region: "Europe", characters: [{ name: "Alice", note: undefined }] },
      { region: "Japan", characters: [{ name: "Bob", note: undefined }] },
    ]);
  });

  it("should combine multiple characters based in the same region into one group", () => {
    const alice = character({ name: "Alice", homeWorld: "WorldA" });
    const second = character({ name: "Second", homeWorld: "WorldA" });

    const groups = groupCharactersByRegion([alice, second], regions);

    expect(groups).toEqual([
      {
        region: "Europe",
        characters: [
          { name: "Alice", note: undefined },
          { name: "Second", note: undefined },
        ],
      },
    ]);
  });

  it("should carry each character's note into its group", () => {
    const alice = character({
      name: "Alice",
      homeWorld: "WorldA",
      note: "Needs a meetup to hand goods over",
    });
    const second = character({ name: "Second", homeWorld: "WorldA" });

    const groups = groupCharactersByRegion([alice, second], regions);

    expect(groups).toEqual([
      {
        region: "Europe",
        characters: [
          { name: "Alice", note: "Needs a meetup to hand goods over" },
          { name: "Second", note: undefined },
        ],
      },
    ]);
  });

  it("should fall back to an 'Unknown region' group for a world that isn't in the directory", () => {
    const groups = groupCharactersByRegion(
      [character({ homeWorld: "Nowhereland" })],
      regions,
    );

    expect(groups).toEqual([
      {
        region: "Unknown region",
        characters: [{ name: "Someone", note: undefined }],
      },
    ]);
  });
});

describe("deriveOwnRetainers", () => {
  it("should pair each retainer with its owning character's home world", () => {
    const alice = character({
      name: "Alice",
      homeWorld: "WorldA",
      retainers: [
        { name: "RetainerA", city: "Ul'dah" },
        { name: "RetainerB", city: "Ul'dah" },
      ],
    });

    expect(deriveOwnRetainers([alice])).toEqual([
      { name: "RetainerA", world: "WorldA" },
      { name: "RetainerB", world: "WorldA" },
    ]);
  });

  it("should pair retainers with each owning character's world across several characters", () => {
    const alice = character({
      name: "Alice",
      homeWorld: "WorldA",
      retainers: [{ name: "RetainerA", city: "Ul'dah" }],
    });
    const bob = character({
      name: "Bob",
      homeWorld: "WorldB",
      retainers: [
        { name: "RetainerB", city: "Kugane" },
        { name: "RetainerC", city: "Kugane" },
      ],
    });

    expect(deriveOwnRetainers([alice, bob])).toEqual([
      { name: "RetainerA", world: "WorldA" },
      { name: "RetainerB", world: "WorldB" },
      { name: "RetainerC", world: "WorldB" },
    ]);
  });

  it("should have no retainers when no character has any", () => {
    expect(deriveOwnRetainers([character()])).toEqual([]);
  });
});

describe("loadTradingConfig", () => {
  it("should build buying regions and own retainers from the loaded roster, passing everything else through", async () => {
    const alice = character({
      name: "Alice",
      homeWorld: "WorldA",
      retainers: [{ name: "RetainerA", city: "Ul'dah" }],
    });
    const bob = character({ name: "Bob", homeWorld: "WorldB" });
    const params = { refreshIntervalMs: 90_000 } as TradingParameters;
    vi.mocked(configService.getCharacters).mockResolvedValue([alice, bob]);
    vi.mocked(configService.getRegions).mockResolvedValue(regions);
    vi.mocked(configService.getTradingParameters).mockResolvedValue(params);
    vi.mocked(configService.getDefaultCharacterName).mockResolvedValue("Alice");

    const config = await loadTradingConfig();

    expect(config).toEqual({
      characters: [alice, bob],
      regions,
      params,
      defaultCharacterName: "Alice",
      buyingRegions: [
        { region: "Europe", characters: [{ name: "Alice", note: undefined }] },
        { region: "Japan", characters: [{ name: "Bob", note: undefined }] },
      ],
      ownRetainers: [{ name: "RetainerA", world: "WorldA" }],
    });
  });
});
