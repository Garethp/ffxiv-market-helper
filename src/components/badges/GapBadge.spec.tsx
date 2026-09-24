// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getDescription } from "../../testing/getDescription";
import { GapBadge } from "./GapBadge";

describe("GapBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("should explain the supply gap, reachable without a pointer", () => {
    render(<GapBadge />);

    const badge = screen.getByText("gap");
    expect(getDescription(badge)).toBe(
      "Current listings are well above recent sale prices — room to undercut",
    );
    expect(badge.getAttribute("tabindex")).toBe("0");
  });
});
