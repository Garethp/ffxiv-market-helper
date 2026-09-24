// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildMarketPageUrl } from "../api/universalis";
import { UniversalisLink } from "./UniversalisLink";

describe("UniversalisLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("should link to the item's market page on the given world or data center", () => {
    render(
      <UniversalisLink itemId={42} worldOrDataCenter="Chaos">
        Chaos
      </UniversalisLink>,
    );

    expect(
      screen.getByRole("link", { name: "Chaos" }).getAttribute("href"),
    ).toBe(buildMarketPageUrl(42, "Chaos"));
  });

  it("should open in a new tab without exposing this page", () => {
    render(
      <UniversalisLink itemId={42} worldOrDataCenter="Chaos">
        Chaos
      </UniversalisLink>,
    );

    const link = screen.getByRole("link", { name: "Chaos" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("should take a label from elsewhere, for a link that's only an icon", () => {
    render(
      <>
        <span id="label">View on Universalis</span>
        <UniversalisLink
          itemId={42}
          worldOrDataCenter="Raiden"
          aria-labelledby="label"
        >
          ↗
        </UniversalisLink>
      </>,
    );

    expect(
      screen.getByRole("link", { name: "View on Universalis" }),
    ).toBeTruthy();
  });
});
