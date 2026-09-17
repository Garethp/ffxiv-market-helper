// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RetainerDetails,
  RosterChangeResult,
} from "../services/characterService";
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
    async (_details: RetainerDetails): Promise<RosterChangeResult> => ({
      ok: true,
    }),
  );
  render(
    <RetainerForm
      marketBoardCities={marketBoardCities}
      submitLabel="Add retainer"
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
    it("should start with no name and no city chosen", () => {
      renderForm();

      expect(nameInput().value).toBe("");
      expect(citySelect().value).toBe("");
    });

    it("should offer each market board city to choose from", () => {
      renderForm();

      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["Choose a city", "Ul'dah", "Kugane"]);
    });

    it("should label the submit button as it's told to", () => {
      renderForm({ submitLabel: "Hire retainer" });

      expect(
        screen.getByRole("button", { name: "Hire retainer" }),
      ).toBeTruthy();
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
      const onSubmit = vi
        .fn<(details: RetainerDetails) => Promise<RosterChangeResult>>()
        .mockResolvedValueOnce({
          ok: false,
          error: { reason: "duplicate-retainer", name: "Amarana" },
        })
        .mockResolvedValueOnce({ ok: true });
      renderForm({ onSubmit });

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();
      await screen.findByRole("alert");
      fillIn({ name: "Brennan", city: "Ul'dah" });
      submit();

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });

  describe("when the change isn't made", () => {
    const refusingSubmit = () =>
      vi.fn(async (): Promise<RosterChangeResult> => ({
        ok: false,
        error: { reason: "duplicate-retainer", name: "Amarana" },
      }));

    it("should explain why", async () => {
      renderForm({ onSubmit: refusingSubmit() });

      fillIn({ name: "Amarana", city: "Ul'dah" });
      submit();

      expect((await screen.findByRole("alert")).textContent).toBe(
        "This character already has a retainer named Amarana.",
      );
    });

    it("should keep the entered details so they can be corrected", async () => {
      renderForm({ onSubmit: refusingSubmit() });

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
