import { describe, expect, it } from "vitest";
import {
  defaultTargetQuantity,
  marketBoardStackSize,
} from "./marketBoardStack";

describe("a market board stack", () => {
  it("convert item stack size to the size of sellable items on the marketboard", () => {
    expect(marketBoardStackSize(1)).toBe(1);
    expect(marketBoardStackSize(99)).toBe(99);
    expect(marketBoardStackSize(999)).toBe(99);
    expect(marketBoardStackSize(9999)).toBe(9999);
  });
});

describe("a newly tracked item's target quantity", () => {
  it("should be three market board stacks", () => {
    expect(defaultTargetQuantity(999)).toBe(297);
    expect(defaultTargetQuantity(1)).toBe(3);
    expect(defaultTargetQuantity(9999)).toBe(29997);
  });
});
