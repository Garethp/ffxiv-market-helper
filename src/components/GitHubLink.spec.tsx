// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GitHubLink } from "./GitHubLink";

const sourceLink = () => screen.getByRole("link", { name: "Source on GitHub" });

afterEach(cleanup);

describe("GitHubLink", () => {
  it("should read as a link to the source, not as a bare icon", () => {
    render(<GitHubLink />);

    expect(sourceLink()).toBeTruthy();
  });

  it("should point at the repository", () => {
    render(<GitHubLink />);

    expect(sourceLink().getAttribute("href")).toBe(
      "https://github.com/Garethp/ffxiv-market-helper",
    );
  });

  it("should leave the app open in its own tab", () => {
    render(<GitHubLink />);

    expect(sourceLink().getAttribute("target")).toBe("_blank");
    expect(sourceLink().getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("should hide the mark itself from screen readers, so it isn't read twice", () => {
    const { container } = render(<GitHubLink />);

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});
