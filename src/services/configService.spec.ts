import { describe, expect, it } from "vitest";
import { configService } from "./configService";

describe("configService", () => {
  describe("the region directory", () => {
    it("should list every world in exactly one data center", async () => {
      const regions = await configService.getRegions();

      const worlds = regions.flatMap((region) =>
        region.dataCenters.flatMap((dataCenter) => dataCenter.worlds),
      );

      expect(worlds.length).toBeGreaterThan(0);
      expect(new Set(worlds).size).toBe(worlds.length);
    });

    it("should give every data center a unique name", async () => {
      const regions = await configService.getRegions();

      const dataCenters = regions.flatMap((region) =>
        region.dataCenters.map((dataCenter) => dataCenter.name),
      );

      expect(new Set(dataCenters).size).toBe(dataCenters.length);
    });
  });

  describe("the trading parameters", () => {
    it("should fetch more sale history entries than it averages over", async () => {
      const params = await configService.getTradingParameters();

      expect(params.sellHistoryFetchCount).toBeGreaterThan(
        params.saleSampleSize,
      );
    });
  });
});
