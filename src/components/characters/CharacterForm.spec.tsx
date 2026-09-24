// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CharacterDetails } from "../../services/characterService";
import type { RegionInfo } from "../../types";
import { CharacterForm } from "./CharacterForm";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [
      { name: "Light", worlds: ["Raiden", "Odin"] },
      { name: "Chaos", worlds: ["Omega"] },
    ],
  },
  {
    name: "Japan",
    dataCenters: [{ name: "Elemental", worlds: ["Tonberry"] }],
  },
];

const renderForm = ({
  initial = { name: "", homeWorld: "" },
  errorMessage,
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
}: {
  initial?: CharacterDetails;
  errorMessage?: string | null;
  onSubmit?: (details: CharacterDetails) => void;
  onCancel?: () => void;
} = {}) => {
  render(
    <CharacterForm
      label="Add a character"
      regions={regions}
      initial={initial}
      submitLabel="Save character"
      errorMessage={errorMessage}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
};

const nameField = () => screen.getByLabelText("Name") as HTMLInputElement;
const homeWorldField = () =>
  screen.getByLabelText("Home world") as HTMLSelectElement;
const noteField = () => screen.getByLabelText("Note") as HTMLInputElement;

const fieldValues = () => ({
  name: nameField().value,
  homeWorld: homeWorldField().value,
  note: noteField().value,
});

const fillIn = ({ name, homeWorld, note }: Partial<CharacterDetails>) => {
  if (name !== undefined) {
    fireEvent.change(nameField(), { target: { value: name } });
  }
  if (homeWorld !== undefined) {
    fireEvent.change(homeWorldField(), { target: { value: homeWorld } });
  }
  if (note !== undefined) {
    fireEvent.change(noteField(), { target: { value: note } });
  }
};

const submitButton = () =>
  screen.getByRole("button", { name: "Save character" });

afterEach(cleanup);

describe("CharacterForm", () => {
  it("should be named as given", () => {
    renderForm();

    expect(screen.getByRole("form", { name: "Add a character" })).toBeTruthy();
  });

  describe("choosing a home world", () => {
    it("should offer every world, grouped by data center and labelled with its region", () => {
      renderForm();

      const groups = within(homeWorldField())
        .getAllByRole("group")
        .map((group) => ({
          label: group.getAttribute("label"),
          worlds: within(group)
            .getAllByRole("option")
            .map((option) => option.textContent),
        }));
      expect(groups).toEqual([
        { label: "Light (Europe)", worlds: ["Raiden", "Odin"] },
        { label: "Chaos (Europe)", worlds: ["Omega"] },
        { label: "Elemental (Japan)", worlds: ["Tonberry"] },
      ]);
    });
  });

  describe("starting values", () => {
    it("should start with the given details filled in", () => {
      renderForm({
        initial: { name: "Alice", homeWorld: "Odin", note: "Main" },
      });

      expect(fieldValues()).toEqual({
        name: "Alice",
        homeWorld: "Odin",
        note: "Main",
      });
    });

    it("should leave the note empty when the given details have none", () => {
      renderForm({ initial: { name: "Alice", homeWorld: "Odin" } });

      expect(noteField().value).toBe("");
    });
  });

  describe("submitting", () => {
    it("should submit the details as entered", () => {
      const { onSubmit } = renderForm();

      fillIn({ name: "Alice", homeWorld: "Tonberry", note: "Crafter" });
      fireEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith({
        name: "Alice",
        homeWorld: "Tonberry",
        note: "Crafter",
      });
    });

    it("should not submit until a name is given", () => {
      const { onSubmit } = renderForm();

      fillIn({ homeWorld: "Raiden" });
      fireEvent.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should not submit until a home world is chosen", () => {
      const { onSubmit } = renderForm();

      fillIn({ name: "Alice" });
      fireEvent.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("an error message", () => {
    it("should show the error message it's given, keeping the details as entered", () => {
      renderForm({
        initial: { name: "Alice", homeWorld: "Raiden", note: "Crafter" },
        errorMessage: "There's already a character named Alice on Raiden.",
      });

      expect(screen.getByRole("alert").textContent).toBe(
        "There's already a character named Alice on Raiden.",
      );
      expect(fieldValues()).toEqual({
        name: "Alice",
        homeWorld: "Raiden",
        note: "Crafter",
      });
    });

    it.each([undefined, null])(
      "should show no error when given %s",
      (errorMessage) => {
        renderForm({ errorMessage });

        expect(screen.queryByRole("alert")).toBeNull();
      },
    );
  });

  describe("cancelling", () => {
    it("should report the cancellation without submitting anything", () => {
      const { onSubmit, onCancel } = renderForm();

      fillIn({ name: "Alice", homeWorld: "Raiden" });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
