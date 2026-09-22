// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RosterValidationError } from "../utils/validation/roster";
import { RosterChangeErrorMessage } from "./RosterChangeErrorMessage";

const alertText = (error: RosterValidationError) => {
  render(<RosterChangeErrorMessage error={error} />);
  return screen.getByRole("alert").textContent;
};

afterEach(cleanup);

describe("RosterChangeErrorMessage", () => {
  describe("when a world isn't known", () => {
    it("should still read sensibly when no world was given", () => {
      expect(alertText({ reason: "unknown-world", world: "" })).toBe(
        "That isn't a known world.",
      );
    });
  });

  describe("when a city isn't a market board city", () => {
    it("should still read sensibly when no city was given", () => {
      expect(alertText({ reason: "unknown-city", city: "" })).toBe(
        "That isn't a market board city.",
      );
    });
  });
});
