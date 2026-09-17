import { describe, expect, it } from "vitest";
import { formatGil } from "./format";

describe("formatGil", () => {
  describe("when there is no value to show", () => {
    it("should show a dash for a missing value", () => {
      expect(formatGil(null)).toBe("—");
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

    it("should show negative amounts in the viewer's locale", () => {
      expect(formatGil(-1500)).toBe((-1500).toLocaleString());
    });
  });
});
