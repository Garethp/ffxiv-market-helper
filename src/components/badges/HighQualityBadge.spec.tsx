// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getDescription } from "../../testing/getDescription";
import { HighQualityBadge } from "./HighQualityBadge";

describe("HighQualityBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("should explain that the item is priced as high quality, reachable without a pointer", () => {
    render(<HighQualityBadge />);

    const badge = screen.getByText("HQ");
    expect(getDescription(badge)).toBe("Priced as high quality");
    expect(badge.getAttribute("tabindex")).toBe("0");
  });
});
