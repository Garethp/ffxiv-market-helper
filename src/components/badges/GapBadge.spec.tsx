// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { descriptionOf } from "../../testing/descriptionOf";
import { GapBadge } from "./GapBadge";

afterEach(cleanup);

describe("GapBadge", () => {
  it("should explain the supply gap, reachable without a pointer", () => {
    render(<GapBadge />);

    const badge = screen.getByText("gap");
    expect(descriptionOf(badge)).toBe(
      "Current listings are well above recent sale prices — room to undercut",
    );
    expect(badge.getAttribute("tabindex")).toBe("0");
  });
});
