// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TrackedItemChangeError } from "../services/trackedItemService";
import { TrackedItemChangeErrorMessage } from "./TrackedItemChangeErrorMessage";

const alertText = (error: TrackedItemChangeError) => {
  render(<TrackedItemChangeErrorMessage error={error} />);
  return screen.getByRole("alert").textContent;
};

afterEach(cleanup);

describe("TrackedItemChangeErrorMessage", () => {
  it("should say what a target quantity needs to be", () => {
    expect(alertText({ reason: "invalid-target-quantity" })).toBe(
      "Target quantity needs to be a whole number of at least 1.",
    );
  });

  it("should say what a sell price ceiling needs to be", () => {
    expect(alertText({ reason: "invalid-sell-price-ceiling" })).toBe(
      "Sell price ceiling needs to be a whole number of gil, or left empty.",
    );
  });

  describe("when the item is already tracked", () => {
    it("should name the item and say it's already tracked as NQ", () => {
      expect(
        alertText({ reason: "already-tracked", name: "Cordial", hq: false }),
      ).toBe("Cordial is already tracked as NQ.");
    });

    it("should name the item and say it's already tracked as HQ", () => {
      expect(
        alertText({ reason: "already-tracked", name: "Cordial", hq: true }),
      ).toBe("Cordial is already tracked as HQ.");
    });
  });
});
