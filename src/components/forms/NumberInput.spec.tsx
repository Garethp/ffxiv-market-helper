// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NumberInput } from "./NumberInput";

/** Holds the value in state the way a consumer would, reporting every change it's given. */
const Harness = ({
  initialValue,
  onChange = () => {},
  adjust = (value) => value,
  min,
}: {
  initialValue?: number;
  onChange?: (value?: number) => void;
  /** How the consumer turns a reported value into the one it holds, e.g. defaulting an empty field. */
  adjust?: (value?: number) => number | undefined;
  min?: number;
}) => {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <NumberInput
        aria-label="Amount"
        placeholder="none"
        min={min}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(adjust(next));
        }}
      />
      <output>{value ?? "undefined"}</output>
    </>
  );
};

const getInput = () => screen.getByLabelText<HTMLInputElement>("Amount");
const getHeldValue = () => screen.getByRole("status").textContent;

/** Focuses the field and types over its contents, as someone editing it would. */
const type = (text: string) => {
  fireEvent.focus(getInput());
  fireEvent.change(getInput(), { target: { value: text } });
};

describe("NumberInput", () => {
  afterEach(() => {
    cleanup();
  });

  describe("showing the value", () => {
    it("should show the value in shorthand where it has one", () => {
      render(<Harness initialValue={500_000} />);

      expect(getInput().value).toBe("500k");
    });

    it("should show nothing, with any placeholder, when there's no value", () => {
      render(<Harness initialValue={undefined} />);

      expect(getInput().value).toBe("");
      expect(getInput().placeholder).toBe("none");
    });
  });

  describe("reading what's typed", () => {
    it("should report no value once the field is cleared", () => {
      const onChange = vi.fn();
      render(<Harness initialValue={500_000} onChange={onChange} />);

      type("");

      expect(onChange).toHaveBeenLastCalledWith(undefined);
    });

    it("should ignore text that isn't an amount, keeping the last one", () => {
      const onChange = vi.fn();
      render(<Harness initialValue={500_000} onChange={onChange} />);

      type("abc");

      expect(onChange).not.toHaveBeenCalled();
      expect(getHeldValue()).toBe("500000");
    });

    it("should ignore amounts below the minimum", () => {
      const onChange = vi.fn();
      render(<Harness initialValue={5} min={1} onChange={onChange} />);

      type("0");

      expect(onChange).not.toHaveBeenCalled();
      expect(getHeldValue()).toBe("5");
    });
  });

  describe("while being edited", () => {
    it("should keep showing exactly what's typed, even once it's been read as an amount", () => {
      render(<Harness initialValue={undefined} />);

      type("1.");

      expect(getHeldValue()).toBe("1");
      expect(getInput().value).toBe("1.");
    });

    it("should keep showing what's typed when the consumer holds a different value than was reported", () => {
      render(
        <Harness initialValue={99} adjust={(value) => value ?? 1} min={1} />,
      );

      type("");

      expect(getHeldValue()).toBe("1");
      expect(getInput().value).toBe("");
    });
  });

  describe("once editing finishes", () => {
    it("should tidy what was typed into the value's shorthand", () => {
      render(<Harness initialValue={undefined} />);

      type("500000");
      fireEvent.blur(getInput());

      expect(getInput().value).toBe("500k");
    });
  });
});
