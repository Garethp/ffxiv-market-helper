import { describe, expect, it } from "vitest";
import { formatBuyLocation, formatGil, formatNumber } from "./format";

describe("formatGil", () => {
  describe("when there is no value to show", () => {
    it("should show a dash for a missing value", () => {
      expect(formatGil(undefined)).toBe("—");
    });

    it("should show a dash for a value that isn't a number", () => {
      expect(formatGil(Number.NaN)).toBe("—");
    });
  });

  describe("when there is a value to show", () => {
    it("should show zero as zero", () => {
      expect(formatGil(0)).toBe((0).toLocaleString());
    });

    it("should round to the nearest whole gil", () => {
      expect(formatGil(99.4)).toBe((99).toLocaleString());
      expect(formatGil(99.5)).toBe((100).toLocaleString());
    });

    it("should group thousands with the viewer's locale separators", () => {
      expect(formatGil(1234567)).toBe((1234567).toLocaleString());
    });
  });
});

describe("formatBuyLocation", () => {
  it("should show only the data center when the listings needed span several worlds", () => {
    expect(formatBuyLocation("Chaos")).toBe("Chaos");
  });

  it("should show the data center and world when everything needed is on one world", () => {
    expect(formatBuyLocation("Chaos", "Omega")).toBe("Chaos - Omega");
  });
});

describe("formatNumber", () => {
  it.each([0, 7, 1234567, 0.5, 12.3456])(
    "should show %s the way the viewer's locale writes it",
    (value) => {
      expect(formatNumber(value)).toBe(value.toLocaleString());
    },
  );
});
