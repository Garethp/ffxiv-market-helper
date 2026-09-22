// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { descriptionOf } from "../../testing/descriptionOf";
import { HintedField } from "./HintedField";

afterEach(cleanup);

describe("HintedField", () => {
  const renderField = () =>
    render(
      <HintedField label="Target quantity" hint="How many to buy.">
        {(id) => <input id={id} />}
      </HintedField>,
    );

  it("should label the field, rather than the hint", () => {
    renderField();

    expect(screen.getByLabelText("Target quantity").tagName).toBe("INPUT");
  });

  it("should explain the field with a hint beside its label", () => {
    renderField();

    expect(
      descriptionOf(
        screen.getByRole("button", { name: "About target quantity" }),
      ),
    ).toBe("How many to buy.");
  });

  it("should give separate fields their own labels and hints", () => {
    render(
      <>
        <HintedField label="Target quantity" hint="How many to buy.">
          {(id) => <input id={id} defaultValue="first" />}
        </HintedField>
        <HintedField label="Sell price ceiling" hint="The most to list for.">
          {(id) => <input id={id} defaultValue="second" />}
        </HintedField>
      </>,
    );

    expect(
      (screen.getByLabelText("Sell price ceiling") as HTMLInputElement).value,
    ).toBe("second");
    expect(
      descriptionOf(
        screen.getByRole("button", { name: "About sell price ceiling" }),
      ),
    ).toBe("The most to list for.");
  });
});
