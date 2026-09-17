import type { WorldRetainer } from "../utils/pricing";
import { findRegionNameForWorld } from "../utils/worldDirectory";
import { configService } from "./configService";
import type {
  Character,
  RegionInfo,
  TrackedItem,
  TradingParameters,
} from "../types";

/** A character as listed under the region it buys through. */
export type BuyingRegionCharacter = Pick<Character, "id" | "name" | "note">;

/**
 * A region as a buy-side source. Every character based there sees the same
 * buy prices — a character reaches every data center in its own region — so
 * buy analysis is deduplicated per region rather than repeated per character.
 */
export interface BuyingRegion {
  region: string;
  /** The characters based in this region, listed for display since they share this region's results. */
  characters: BuyingRegionCharacter[];
}

/** Groups characters by region — every character in a region sees identical buy prices. */
export const groupCharactersByRegion = (
  characters: Character[],
  regions: RegionInfo[],
): BuyingRegion[] => {
  const groups = new Map<string, BuyingRegionCharacter[]>();
  characters.forEach((character) => {
    const region =
      findRegionNameForWorld(character.homeWorld, regions) ?? "Unknown region";
    const group = groups.get(region) ?? [];
    group.push({
      id: character.id,
      name: character.name,
      note: character.note,
    });
    groups.set(region, group);
  });
  return Array.from(groups, ([region, group]) => ({
    region,
    characters: group,
  }));
};

/** Every retainer across our whole roster, with the world it's actually on — used to recognize our own listings regardless of which character owns them. */
export const deriveOwnRetainers = (
  characters: Character[],
): WorldRetainer[] => {
  return characters.flatMap((character) =>
    character.retainers.map((retainer) => ({
      name: retainer.name,
      world: character.homeWorld,
    })),
  );
};

/** Everything from ConfigService, loaded once. */
export interface LoadedConfig {
  trackedItems: TrackedItem[];
  regions: RegionInfo[];
  marketBoardCities: string[];
  params: TradingParameters;
}

export const loadConfig = async (): Promise<LoadedConfig> => {
  const [trackedItems, regions, marketBoardCities, params] = await Promise.all([
    configService.getTrackedItems(),
    configService.getRegions(),
    configService.getMarketBoardCities(),
    configService.getTradingParameters(),
  ]);
  return { trackedItems, regions, marketBoardCities, params };
};

/** The loaded config together with the character roster and what's worked out from it, shared by every page. */
export type TradingConfig = LoadedConfig & {
  characters: Character[];
  buyingRegions: BuyingRegion[];
  ownRetainers: WorldRetainer[];
};

export const buildTradingConfig = (
  config: LoadedConfig,
  characters: Character[],
): TradingConfig => ({
  ...config,
  characters,
  buyingRegions: groupCharactersByRegion(characters, config.regions),
  ownRetainers: deriveOwnRetainers(characters),
});
