import { describe, expect, it } from "vitest";
import {
  calculateDefaultTargetQuantity,
  calculateMarketBoardStackSize,
} from "./marketBoardStack";

describe("market board stacks", () => {
  describe("a market board stack", () => {
    it("convert item stack size to the size of sellable items on the marketboard", () => {
      expect(calculateMarketBoardStackSize(1)).toBe(1);
      expect(calculateMarketBoardStackSize(99)).toBe(99);
      expect(calculateMarketBoardStackSize(999)).toBe(99);
      expect(calculateMarketBoardStackSize(9999)).toBe(9999);
    });
  });

  describe("a newly tracked item's target quantity", () => {
    it("should be three market board stacks", () => {
      expect(calculateDefaultTargetQuantity(999)).toBe(297);
      expect(calculateDefaultTargetQuantity(1)).toBe(3);
      expect(calculateDefaultTargetQuantity(9999)).toBe(29997);
    });
  });
});
