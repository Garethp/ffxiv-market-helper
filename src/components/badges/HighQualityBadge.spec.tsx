// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { descriptionOf } from "../../testing/descriptionOf";
import { HighQualityBadge } from "./HighQualityBadge";

afterEach(cleanup);

describe("HighQualityBadge", () => {
  it("should explain that the item is priced as high quality, reachable without a pointer", () => {
    render(<HighQualityBadge />);

    const badge = screen.getByText("HQ");
    expect(descriptionOf(badge)).toBe("Priced as high quality");
    expect(badge.getAttribute("tabindex")).toBe("0");
  });
});
