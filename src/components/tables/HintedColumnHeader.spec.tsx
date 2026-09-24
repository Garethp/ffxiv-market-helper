// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getDescription } from "../../testing/getDescription";
import { HintedColumnHeader } from "./HintedColumnHeader";

const renderHeader = () =>
  render(
    <table>
      <thead>
        <tr>
          <HintedColumnHeader name="Profit / item" hint="Profit after tax." />
        </tr>
      </thead>
    </table>,
  );

describe("HintedColumnHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be named after the column alone, leaving the hint out", () => {
    renderHeader();

    expect(
      screen.getByRole("columnheader", { name: "Profit / item" }),
    ).toBeTruthy();
  });

  it("should explain the column with a hint beside its name", () => {
    renderHeader();

    expect(
      getDescription(
        screen.getByRole("button", { name: "About profit / item" }),
      ),
    ).toBe("Profit after tax.");
  });
});
