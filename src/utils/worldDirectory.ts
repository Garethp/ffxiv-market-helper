import type { RegionInfo } from "../types";

const findRegion = (
  world: string,
  regions: RegionInfo[],
): RegionInfo | undefined => {
  return regions.find((region) =>
    region.dataCenters.some((dataCenter) => dataCenter.worlds.includes(world)),
  );
};

/** Which region a world belongs to, or undefined if it's not in the directory. */
export const findRegionNameForWorld = (
  world: string,
  regions: RegionInfo[],
): string | undefined => {
  return findRegion(world, regions)?.name;
};

/** Every data center in a named region — the buy-side reach is identical for every character in it. */
export const findDataCentersForRegion = (
  regionName: string,
  regions: RegionInfo[],
): string[] => {
  return (
    regions
      .find((region) => region.name === regionName)
      ?.dataCenters.map((dataCenter) => dataCenter.name) ?? []
  );
};
