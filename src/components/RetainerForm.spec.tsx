// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RetainerDetails } from "../services/characterService";
import type { RosterValidationError } from "../utils/validation/roster";
import { RetainerForm } from "./RetainerForm";

const marketBoardCities = ["Ul'dah", "Kugane"];

const nameInput = () =>
  screen.getByLabelText("Retainer name") as HTMLInputElement;
const citySelect = () => screen.getByLabelText("City") as HTMLSelectElement;

const fillIn = ({ name, city }: RetainerDetails) => {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.change(citySelect(), { target: { value: city } });
};

const renderForm = (
  props: Partial<Parameters<typeof RetainerForm>[0]> = {},
) => {
  const onSubmit = vi.fn(
    async (_details: RetainerDetails): Promise<void> => {},
  );
  render(
    <RetainerForm
      marketBoardCities={marketBoardCities}
      submitLabel="Add retainer"
      // Nothing wrong with the details, whatever they are.
      validate={() => undefined}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit: (props.onSubmit as typeof onSubmit) ?? onSubmit };
};

const submit = (label = "Add retainer") =>
  fireEvent.click(screen.getByRole("button", { name: label }));

afterEach(cleanup);

describe("RetainerForm", () => {
  describe("entering a new retainer", () => {
    it("should offer each market board city to choose from", () => {
      renderForm();

      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["Choose a city", "Ul'dah", "Kugane"]);
    });
  });

  describe("changing an existing retainer", () => {
    it("should start with the retainer's current details", () => {
      renderForm({ initialDetails: { name: "Amarana", city: "Kugane" } });

      expect(nameInput().value).toBe("Amarana");
      expect(citySelect().value).toBe("Kugane");
    });
  });

  describe("submitting", () => {
    it("should submit the entered name and city", async () => {
      const { onSubmit } = renderForm();

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          name: "Amarana",
          city: "Ul'dah",
        }),
      );
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

  describe("when the change is made", () => {
    it("should clear the form, ready for the next retainer", async () => {
      renderForm();

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();

      await waitFor(() => expect(nameInput().value).toBe(""));
      expect(citySelect().value).toBe("");
    });

    it("should no longer show why an earlier change wasn't made", async () => {
      const validate = vi
        .fn<(details: RetainerDetails) => RosterValidationError | undefined>()
        .mockReturnValueOnce({ reason: "duplicate-retainer", name: "Amarana" })
        .mockReturnValue(undefined);
      renderForm({ validate });

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();
      await screen.findByRole("alert");
      fillIn({ name: "Brennan", city: "Ul'dah" });
      submit();

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });

  describe("when the character wouldn't accept the retainer", () => {
    const refuses = () => ({
      reason: "duplicate-retainer" as const,
      name: "Amarana",
    });

    it("should explain why", async () => {
      renderForm({ validate: refuses });

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();

      expect((await screen.findByRole("alert")).textContent).toBe(
        "This character already has a retainer named Amarana.",
      );
    });

    it("should not attempt the change at all", async () => {
      const { onSubmit } = renderForm({ validate: refuses });

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();

      await screen.findByRole("alert");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should keep the entered details so they can be corrected", async () => {
      renderForm({ validate: refuses });

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();
      await screen.findByRole("alert");

      expect(nameInput().value).toBe("Amarana");
      expect(citySelect().value).toBe("Ul'dah");
    });
  });

  describe("when the change itself fails", () => {
    it("should say something went wrong, without guessing at a reason", async () => {
      renderForm({ onSubmit: () => Promise.reject(new Error("no storage")) });

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Something went wrong. Try again shortly.",
      );
    });

    it("should keep the entered details so the change can be tried again", async () => {
      renderForm({ onSubmit: () => Promise.reject(new Error("no storage")) });

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();
      await screen.findByRole("alert");

      expect(nameInput().value).toBe("Amarana");
      expect(citySelect().value).toBe("Ul'dah");
    });
  });

  describe("cancelling", () => {
    it("should offer no way to cancel when cancelling isn't possible", () => {
      renderForm();

      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    });

    it("should report the cancellation without submitting anything", () => {
      const onCancel = vi.fn();
      const { onSubmit } = renderForm({
        initialDetails: { name: "Amarana", city: "Kugane" },
        onCancel,
      });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
