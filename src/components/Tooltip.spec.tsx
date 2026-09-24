// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDescription } from "../testing/getDescription";
import { Tooltip } from "./Tooltip";

const SCREEN_WIDTH = 375;

/** A tooltip on a screen of the given width, that would sit between `left` and `right` unmoved. */
const renderPlacedTooltip = (left: number, right: number) => {
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
    SCREEN_WIDTH,
  );
  render(
    <Tooltip text="Room to undercut">
      {(tooltipId) => (
        <span tabIndex={0} aria-describedby={tooltipId}>
          gap
        </span>
      )}
    </Tooltip>,
  );
  const tooltip = screen.getByRole("tooltip");
  placeTooltip(tooltip, left, right);
  return tooltip;
};

/** Where the tooltip sits before it's slid anywhere. Any slide it's been given is measured too. */
const placeTooltip = (tooltip: HTMLElement, left: number, right: number) => {
  vi.spyOn(tooltip, "getBoundingClientRect").mockImplementation(() => {
    const shift = parseFloat(tooltip.style.translate) || 0;
    return { left: left + shift, right: right + shift } as DOMRect;
  });
};

const hover = () => fireEvent.mouseEnter(screen.getByText("gap"));

describe("Tooltip", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

    expect(getDescription(screen.getByText("gap"))).toBe("Room to undercut");
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

    expect(getDescription(screen.getByText("one"))).toBe("First");
    expect(getDescription(screen.getByText("two"))).toBe("Second");
  });

  it("should mark its text as a tooltip", () => {
    render(
      <Tooltip text="Room to undercut">
        {(tooltipId) => <span aria-describedby={tooltipId}>gap</span>}
      </Tooltip>,
    );

    expect(screen.getByRole("tooltip").textContent).toBe("Room to undercut");
  });

  describe("staying on the screen", () => {
    it("should stay where it opens when it fits on the screen", () => {
      const tooltip = renderPlacedTooltip(100, 250);

      hover();

      expect(tooltip.style.translate).toBe("");
    });

    it("should slide back from the right edge of the screen, leaving a margin", () => {
      const tooltip = renderPlacedTooltip(300, 420);

      hover();

      expect(tooltip.style.translate).toBe("-61px 0");
    });

    it("should slide back from the left edge of the screen, leaving a margin", () => {
      const tooltip = renderPlacedTooltip(-20, 100);

      hover();

      expect(tooltip.style.translate).toBe("36px 0");
    });

    it("should line up with the left edge when it's too wide for the screen", () => {
      const tooltip = renderPlacedTooltip(100, 500);

      hover();

      expect(tooltip.style.translate).toBe("-84px 0");
    });

    it("should keep on the screen when opened by focus as well as hover", () => {
      const tooltip = renderPlacedTooltip(300, 420);

      fireEvent.focus(screen.getByText("gap"));

      expect(tooltip.style.translate).toBe("-61px 0");
    });

    it("should slide back onto the screen when it grows after opening", () => {
      let onResize = () => {};
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback: () => void) {
            onResize = callback;
          }
          observe() {}
          disconnect() {}
        },
      );
      const tooltip = renderPlacedTooltip(100, 250);
      hover();

      placeTooltip(tooltip, 100, 420);
      act(() => onResize());

      expect(tooltip.style.translate).toBe("-61px 0");
    });

    it("should work out where it sits afresh each time it opens", () => {
      const tooltip = renderPlacedTooltip(300, 420);
      hover();

      placeTooltip(tooltip, 100, 250);
      hover();

      expect(tooltip.style.translate).toBe("");
    });
  });
});
