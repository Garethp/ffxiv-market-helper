// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RosterChangeError } from "../services/characterService";
import { RosterChangeErrorMessage } from "./RosterChangeErrorMessage";

const alertText = (error: RosterChangeError) => {
  render(<RosterChangeErrorMessage error={error} />);
  return screen.getByRole("alert").textContent;
};

afterEach(cleanup);

describe("RosterChangeErrorMessage", () => {
  it("should say a name is needed when none was given", () => {
    expect(alertText({ reason: "missing-name" })).toBe("A name is needed.");
  });

  describe("when a world isn't known", () => {
    it("should name the world that isn't known", () => {
      expect(alertText({ reason: "unknown-world", world: "Atlantis" })).toBe(
        "Atlantis isn't a known world.",
      );
    });

    it("should still read sensibly when no world was given", () => {
      expect(alertText({ reason: "unknown-world", world: "" })).toBe(
        "That isn't a known world.",
      );
    });
  });

  describe("when a city isn't a market board city", () => {
    it("should name the city", () => {
      expect(alertText({ reason: "unknown-city", city: "Atlantis" })).toBe(
        "Atlantis isn't a market board city.",
      );
    });

    it("should still read sensibly when no city was given", () => {
      expect(alertText({ reason: "unknown-city", city: "" })).toBe(
        "That isn't a market board city.",
      );
    });
  });

  it("should name the character and world that are already on the roster", () => {
    expect(
      alertText({
        reason: "duplicate-character",
        name: "Alisaie Leveilleur",
        world: "Twintania",
      }),
    ).toBe(
      "There's already a character named Alisaie Leveilleur on Twintania.",
    );
  });

  it("should name the retainer the character already has", () => {
    expect(alertText({ reason: "duplicate-retainer", name: "Moogle" })).toBe(
      "This character already has a retainer named Moogle.",
    );
  });

  it("should suggest refreshing when the character has since been removed", () => {
    expect(alertText({ reason: "character-not-found" })).toBe(
      "This character has since been removed. Refresh the page to see the current roster.",
    );
  });

  it("should suggest refreshing when the retainer has since been removed", () => {
    expect(alertText({ reason: "retainer-not-found" })).toBe(
      "This retainer has since been removed. Refresh the page to see the current roster.",
    );
  });
});
