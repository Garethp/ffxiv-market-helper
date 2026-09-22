// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { descriptionOf } from "../testing/descriptionOf";
import { Hint } from "./Hint";

afterEach(cleanup);

describe("Hint", () => {
  it("should be named for what it explains", () => {
    render(<Hint about="Target quantity">How many to buy.</Hint>);

    expect(
      screen.getByRole("button", { name: "About target quantity" }),
    ).toBeTruthy();
  });

  it("should be described by its explanation", () => {
    render(<Hint about="Target quantity">How many to buy.</Hint>);

    expect(
      descriptionOf(
        screen.getByRole("button", { name: "About target quantity" }),
      ),
    ).toBe("How many to buy.");
  });

  it("should not submit the form it's in when used", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Hint about="Target quantity">How many to buy.</Hint>
      </form>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "About target quantity" }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
