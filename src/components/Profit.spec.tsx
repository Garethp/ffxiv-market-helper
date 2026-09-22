// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Profit } from "./Profit";

afterEach(cleanup);

const renderProfit = (amount: number | null) =>
  render(<Profit amount={amount} />).container.firstElementChild!;

describe("Profit", () => {
  it("should show the amount in gil", () => {
    renderProfit(13_068);

    expect(screen.getByText((13_068).toLocaleString())).toBeTruthy();
  });

  it("should mark a gain as positive", () => {
    expect(renderProfit(132).className).toBe("positive");
  });

  it("should treat breaking even as positive", () => {
    expect(renderProfit(0).className).toBe("positive");
  });

  it("should mark a loss as negative", () => {
    expect(renderProfit(-5).className).toBe("negative");
  });

  it("should show a dash, marked neither way, when there's no profit to show", () => {
    const profit = renderProfit(null);

    expect(profit.className).toBe("");
    expect(profit.textContent).toBe("—");
  });
});
