// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { descriptionOf } from "../testing/descriptionOf";
import { Tooltip } from "./Tooltip";

afterEach(cleanup);

describe("Tooltip", () => {
  it("should describe what it wraps, for anything that already reads sensibly", () => {
    render(
      <Tooltip text="Room to undercut">
        {(tooltipId) => (
          <span tabIndex={0} aria-describedby={tooltipId}>
            gap
          </span>
        )}
      </Tooltip>,
    );

    expect(descriptionOf(screen.getByText("gap"))).toBe("Room to undercut");
  });

  it("should be able to name a control that has no text of its own", () => {
    render(
      <Tooltip text="Copy item name">
        {(tooltipId) => (
          <button type="button" aria-labelledby={tooltipId}>
            📋
          </button>
        )}
      </Tooltip>,
    );

    expect(screen.getByRole("button", { name: "Copy item name" })).toBeTruthy();
  });

  it("should give each tooltip its own ID, so they don't describe each other", () => {
    render(
      <>
        <Tooltip text="First">
          {(tooltipId) => <span aria-describedby={tooltipId}>one</span>}
        </Tooltip>
        <Tooltip text="Second">
          {(tooltipId) => <span aria-describedby={tooltipId}>two</span>}
        </Tooltip>
      </>,
    );

    expect(descriptionOf(screen.getByText("one"))).toBe("First");
    expect(descriptionOf(screen.getByText("two"))).toBe("Second");
  });

  it("should mark its text as a tooltip", () => {
    render(
      <Tooltip text="Room to undercut">
        {(tooltipId) => <span aria-describedby={tooltipId}>gap</span>}
      </Tooltip>,
    );

    expect(screen.getByRole("tooltip").textContent).toBe("Room to undercut");
  });
});
