// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BuyingRegion } from "../services/tradingConfig";
import type { DisplayRow } from "../types";
import { BuyingRegionSection } from "./BuyingRegionSection";
import { withQueryClient } from "../testing/withQueryClient";

afterEach(cleanup);

const renderSection = (
  buyingRegion: BuyingRegion,
  {
    rows = [],
    staleWarningThresholdMs = null,
    sellWorld = "Raiden",
    gapThresholdMultiplier = 1.1,
  }: {
    rows?: DisplayRow[];
    staleWarningThresholdMs?: number | null;
    gapThresholdMultiplier?: number;
    sellWorld?: string;
  } = {},
) =>
  render(
    <BuyingRegionSection
      buyingRegion={buyingRegion}
      rows={rows}
      staleWarningThresholdMs={staleWarningThresholdMs}
      sellWorld={sellWorld}
      gapThresholdMultiplier={gapThresholdMultiplier}
    />,
    { wrapper: withQueryClient() },
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
