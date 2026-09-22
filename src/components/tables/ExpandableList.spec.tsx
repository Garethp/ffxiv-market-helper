// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExpandableList, ExpandableRow } from "./ExpandableList";

afterEach(cleanup);

const renderRow = () =>
  render(
    <ExpandableList>
      <ExpandableRow
        heading="Wind Cluster"
        expandLabel="Show every figure for Wind Cluster"
        summary={<p>Summary</p>}
        details={<p>Details</p>}
      >
        <p>
          Always shown <a href="#market">Market</a>{" "}
          <button type="button">Copy</button>
        </p>
      </ExpandableRow>
    </ExpandableList>,
  );

const expandButton = () =>
  screen.getByRole("button", { name: "Show every figure for Wind Cluster" });

const isExpanded = () =>
  expandButton().getAttribute("aria-expanded") === "true";

describe("ExpandableRow", () => {
  it("should show its summary until it's expanded, then its details in its place", () => {
    renderRow();
    expect(screen.queryByText("Summary")).not.toBeNull();
    expect(screen.queryByText("Details")).toBeNull();

    fireEvent.click(expandButton());

    expect(screen.queryByText("Summary")).toBeNull();
    expect(screen.queryByText("Details")).not.toBeNull();
  });

  it("should show its heading and what's always shown, whether expanded or not", () => {
    renderRow();
    expect(screen.queryByText("Wind Cluster")).not.toBeNull();
    expect(screen.queryByText(/Always shown/)).not.toBeNull();

    fireEvent.click(expandButton());

    expect(screen.queryByText("Wind Cluster")).not.toBeNull();
    expect(screen.queryByText(/Always shown/)).not.toBeNull();
  });

  it("should expand when tapped anywhere on it, and collapse when tapped again", () => {
    renderRow();

    fireEvent.click(screen.getByText("Summary"));
    expect(isExpanded()).toBe(true);

    fireEvent.click(screen.getByText("Wind Cluster"));
    expect(isExpanded()).toBe(false);
  });

  it("should expand and collapse from its button, so it can be without a pointer", () => {
    renderRow();

    fireEvent.click(expandButton());
    expect(isExpanded()).toBe(true);

    fireEvent.click(expandButton());
    expect(isExpanded()).toBe(false);
  });

  it("should leave the links and buttons in it to do their own thing", () => {
    renderRow();

    fireEvent.click(screen.getByRole("link", { name: "Market" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(isExpanded()).toBe(false);
  });
});
