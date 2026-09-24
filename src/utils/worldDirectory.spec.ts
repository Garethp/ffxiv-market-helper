import { describe, expect, it } from "vitest";
import type { RegionInfo } from "../types";
import {
  findDataCenterForWorld,
  findDataCentersForRegion,
  findRegionNameForWorld,
} from "./worldDirectory";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [
      { name: "Chaos", worlds: ["Cerberus"] },
      { name: "Light", worlds: ["WorldA"] },
    ],
  },
  {
    name: "Japan",
    dataCenters: [{ name: "Elemental", worlds: ["Carbuncle"] }],
  },
];

describe("world directory", () => {
  describe("findRegionNameForWorld", () => {
    it("should find the region a world belongs to", () => {
      expect(findRegionNameForWorld("WorldA", regions)).toBe("Europe");
    });

    it("should find a world that belongs to a region other than the first", () => {
      expect(findRegionNameForWorld("Carbuncle", regions)).toBe("Japan");
    });

    it("should have no region for a world that isn't in the directory", () => {
      expect(findRegionNameForWorld("Nowhereland", regions)).toBeUndefined();
    });
  });

  describe("findDataCentersForRegion", () => {
    it("should list every data center in the named region", () => {
      expect(findDataCentersForRegion("Europe", regions)).toEqual([
        "Chaos",
        "Light",
      ]);
    });

    it("should list only the named region's data centers when it isn't the first region", () => {
      expect(findDataCentersForRegion("Japan", regions)).toEqual(["Elemental"]);
    });

    it("should have no data centers for a region that isn't in the directory", () => {
      expect(findDataCentersForRegion("Nowhereland", regions)).toEqual([]);
    });
  });

  describe("findDataCenterForWorld", () => {
    it("should find the data center a world belongs to", () => {
      expect(findDataCenterForWorld("WorldA", regions)).toBe("Light");
    });

    it("should find a world in a region other than the first", () => {
      expect(findDataCenterForWorld("Carbuncle", regions)).toBe("Elemental");
    });

    it("should have no data center for a world that isn't in the directory", () => {
      expect(findDataCenterForWorld("Nowhereland", regions)).toBeUndefined();
    });
  });
});
