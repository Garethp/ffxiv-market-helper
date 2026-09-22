// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { descriptionOf } from "../../testing/descriptionOf";
import { HintedColumnHeader } from "./HintedColumnHeader";

afterEach(cleanup);

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
  it("should be named after the column alone, leaving the hint out", () => {
    renderHeader();

    expect(
      screen.getByRole("columnheader", { name: "Profit / item" }),
    ).toBeTruthy();
  });

  it("should explain the column with a hint beside its name", () => {
    renderHeader();

    expect(
      descriptionOf(
        screen.getByRole("button", { name: "About profit / item" }),
      ),
    ).toBe("Profit after tax.");
  });
});
