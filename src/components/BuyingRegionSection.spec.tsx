// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BuyingRegion } from "../services/tradingConfig";
import { BuyingRegionSection } from "./BuyingRegionSection";

afterEach(cleanup);

const renderSection = (buyingRegion: BuyingRegion) =>
  render(
    <BuyingRegionSection buyingRegion={buyingRegion}>
      <table />
    </BuyingRegionSection>,
  );

describe("BuyingRegionSection", () => {
  describe("introducing the region", () => {
    it("should show the note of each character that has one", () => {
      const { container } = renderSection({
        region: "Japan",
        characters: [
          { id: "bob", name: "Bob", note: "Needs a meetup to hand goods over" },
          { id: "carol", name: "Carol" },
          { id: "dave", name: "Dave", note: "Retainers only" },
        ],
      });

      expect(
        Array.from(container.querySelectorAll(".character-note")).map(
          (note) => note.textContent,
        ),
      ).toEqual([
        "Bob: Needs a meetup to hand goods over",
        "Dave: Retainers only",
      ]);
    });
  });
});
