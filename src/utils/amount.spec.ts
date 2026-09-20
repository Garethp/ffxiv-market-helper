import { describe, expect, it } from "vitest";
import { formatAmount, parseAmount } from "./amount";

describe("parseAmount", () => {
  describe("reading plain numbers", () => {
    it("should read a whole number", () => {
      expect(parseAmount("1500")).toEqual({ status: "valid", value: 1500 });
    });

    it("should read a decimal number", () => {
      expect(parseAmount("2.5")).toEqual({ status: "valid", value: 2.5 });
    });

    it("should ignore thousands separators", () => {
      expect(parseAmount("1,500,000")).toEqual({
        status: "valid",
        value: 1_500_000,
      });
    });

    it("should ignore surrounding whitespace", () => {
      expect(parseAmount("  42 ")).toEqual({ status: "valid", value: 42 });
    });

    it("should read a negative number", () => {
      expect(parseAmount("-300")).toEqual({ status: "valid", value: -300 });
    });
  });

  describe("reading suffixed amounts", () => {
    it.each([
      ["500k", 500_000],
      ["2m", 2_000_000],
      ["1b", 1_000_000_000],
    ])("should read %s as %d", (text, value) => {
      expect(parseAmount(text)).toEqual({ status: "valid", value });
    });

    it("should read a suffix in either case", () => {
      expect(parseAmount("2M")).toEqual({ status: "valid", value: 2_000_000 });
    });

    it("should read a decimal amount before a suffix exactly", () => {
      expect(parseAmount("1.1m")).toEqual({
        status: "valid",
        value: 1_100_000,
      });
    });

    it("should read a suffix after a space", () => {
      expect(parseAmount("500 k")).toEqual({ status: "valid", value: 500_000 });
    });

    it("should read a decimal amount with no leading digit", () => {
      expect(parseAmount(".5m")).toEqual({ status: "valid", value: 500_000 });
    });
  });

  describe("reading nothing", () => {
    it.each(["", "   "])("should treat %j as empty", (text) => {
      expect(parseAmount(text)).toEqual({ status: "empty" });
    });
  });

  describe("rejecting what isn't an amount", () => {
    it.each(["abc", "k", "5kk", "1.2.3", "5x", "-"])(
      "should reject %j",
      (text) => {
        expect(parseAmount(text)).toEqual({ status: "invalid" });
      },
    );
  });
});

describe("formatAmount", () => {
  it.each([
    [99, "99"],
    [500_000, "500k"],
    [2_000_000, "2m"],
    [1_500_000, "1.5m"],
    [1_100_000, "1.1m"],
    [1_250_000, "1.25m"],
    [1_000_000_000, "1b"],
    [0, "0"],
  ])("should write %d as %s", (value, text) => {
    expect(formatAmount(value)).toBe(text);
  });

  it("should write an amount a suffix can't represent in a couple of decimal places as a plain number", () => {
    expect(formatAmount(1_234_567)).toBe("1234567");
  });

  it("should use a smaller suffix when the larger one can't represent the amount exactly", () => {
    expect(formatAmount(1_234_000)).toBe("1234k");
  });

  it.each([1500, 1_234_567, 1_250_000, 2.5])(
    "should write %d so that it reads back as the same amount",
    (value) => {
      expect(parseAmount(formatAmount(value))).toEqual({
        status: "valid",
        value,
      });
    },
  );
});
