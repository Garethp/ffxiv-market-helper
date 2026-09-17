import type { WorldRetainer } from "../utils/pricing";
import { findRegionNameForWorld } from "../utils/worldDirectory";
import { configService } from "./configService";
import type {
  Character,
  RegionInfo,
  TrackedItem,
  TradingParameters,
} from "../types";

/**
 * A region as a buy-side source. Every character based there sees the same
 * buy prices — a character reaches every data center in its own region — so
 * buy analysis is deduplicated per region rather than repeated per character.
 */
export interface BuyingRegion {
  region: string;
  /** The characters based in this region, listed for display since they share this region's results. */
  characters: { name: string; note?: string }[];
}

/** Groups characters by region — every character in a region sees identical buy prices. */
export const groupCharactersByRegion = (
  characters: Character[],
  regions: RegionInfo[],
): BuyingRegion[] => {
  const groups = new Map<string, { name: string; note?: string }[]>();
  characters.forEach((character) => {
    const region =
      findRegionNameForWorld(character.homeWorld, regions) ?? "Unknown region";
    const group = groups.get(region) ?? [];
    group.push({ name: character.name, note: character.note });
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

/** Everything from ConfigService, loaded once and shared by every page. */
export interface TradingConfig {
  trackedItems: TrackedItem[];
  characters: Character[];
  regions: RegionInfo[];
  params: TradingParameters;
  defaultCharacterName: string;
  buyingRegions: BuyingRegion[];
  ownRetainers: WorldRetainer[];
}

export const loadTradingConfig = async (): Promise<TradingConfig> => {
  const [trackedItems, characters, regions, params, defaultCharacterName] =
    await Promise.all([
      configService.getTrackedItems(),
      configService.getCharacters(),
      configService.getRegions(),
      configService.getTradingParameters(),
      configService.getDefaultCharacterName(),
    ]);
  return {
    trackedItems,
    characters,
    regions,
    params,
    defaultCharacterName,
    buyingRegions: groupCharactersByRegion(characters, regions),
    ownRetainers: deriveOwnRetainers(characters),
  };
};
