// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RetainerDetails } from "../../services/characterService";
import { RetainerForm } from "./RetainerForm";

const marketBoardCities = ["Ul'dah", "Kugane"];

const renderForm = ({
  initial = { name: "", city: "" },
  errorMessage,
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
}: {
  initial?: RetainerDetails;
  errorMessage?: string;
  onSubmit?: (details: RetainerDetails) => void;
  onCancel?: () => void;
} = {}) => {
  render(
    <RetainerForm
      label="Add a retainer"
      marketBoardCities={marketBoardCities}
      initial={initial}
      submitLabel="Add retainer"
      errorMessage={errorMessage}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
};

const getNameInput = () =>
  screen.getByLabelText("Retainer name") as HTMLInputElement;
const getCitySelect = () => screen.getByLabelText("City") as HTMLSelectElement;

const fillIn = ({ name, city }: RetainerDetails) => {
  fireEvent.change(getNameInput(), { target: { value: name } });
  fireEvent.change(getCitySelect(), { target: { value: city } });
};

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Add retainer" }));

describe("RetainerForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be named as given", () => {
    renderForm();

    expect(screen.getByRole("form", { name: "Add a retainer" })).toBeTruthy();
  });

  it("should offer each market board city to choose from", () => {
    renderForm();

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Choose a city", "Ul'dah", "Kugane"]);
  });

  it("should start with the given details filled in", () => {
    renderForm({ initial: { name: "Amarana", city: "Kugane" } });

    expect(getNameInput().value).toBe("Amarana");
    expect(getCitySelect().value).toBe("Kugane");
  });

  describe("submitting", () => {
    it("should submit the entered name and city", () => {
      const { onSubmit } = renderForm();

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();

      expect(onSubmit).toHaveBeenCalledWith({
        name: "Amarana",
        city: "Ul'dah",
      });
    });

    it("should not submit without a name", () => {
      const { onSubmit } = renderForm();

      fillIn({ name: "", city: "Ul'dah" });
      submit();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should not submit without a city chosen", () => {
      const { onSubmit } = renderForm();

      fillIn({ name: "Amarana", city: "" });
      submit();

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("an error message", () => {
    it("should show the error message it's given, keeping the details as entered", () => {
      renderForm({
        initial: { name: "Amarana", city: "Ul'dah" },
        errorMessage: "This character already has a retainer named Amarana.",
      });

      expect(screen.getByRole("alert").textContent).toBe(
        "This character already has a retainer named Amarana.",
      );
      expect(getNameInput().value).toBe("Amarana");
      expect(getCitySelect().value).toBe("Ul'dah");
    });

    it("should show no error when it's given none", () => {
      renderForm();

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("cancelling", () => {
    it("should report the cancellation without submitting anything", () => {
      const { onSubmit, onCancel } = renderForm({
        initial: { name: "Amarana", city: "Kugane" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
