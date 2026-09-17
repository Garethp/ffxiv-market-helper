import { describe, expect, it } from "vitest";
import { buildMarketPageUrl } from "./universalis";

describe("buildMarketPageUrl", () => {
  it("should link to the item's market page scoped to the given world or data center", () => {
    expect(buildMarketPageUrl(12345, "Chaos")).toBe(
      "https://universalis.app/market/12345?server=Chaos",
    );
  });

  it("should still produce a valid link when the world or data center name contains special characters", () => {
    expect(buildMarketPageUrl(12345, "Test World & More")).toBe(
      "https://universalis.app/market/12345?server=Test%20World%20%26%20More",
    );
  });
});
