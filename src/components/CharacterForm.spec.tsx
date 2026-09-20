// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CharacterDetails,
  RosterChangeResult,
} from "../services/characterService";
import type { RegionInfo } from "../types";
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

const succeeds = (): RosterChangeResult => ({ ok: true });

const renderForm = ({
  initialDetails,
  onSubmit = vi.fn(async () => succeeds()),
  onCancel,
}: {
  initialDetails?: CharacterDetails;
  onSubmit?: (details: CharacterDetails) => Promise<RosterChangeResult>;
  onCancel?: () => void;
} = {}) => {
  render(
    <CharacterForm
      regions={regions}
      initialDetails={initialDetails}
      submitLabel="Save character"
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return onSubmit;
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
    it("should start empty when there are no details to start from", () => {
      renderForm();

      expect(fieldValues()).toEqual({ name: "", homeWorld: "", note: "" });
    });

    it("should start with the given details filled in", () => {
      renderForm({
        initialDetails: { name: "Alice", homeWorld: "Odin", note: "Main" },
      });

      expect(fieldValues()).toEqual({
        name: "Alice",
        homeWorld: "Odin",
        note: "Main",
      });
    });

    it("should leave the note empty when the given details have none", () => {
      renderForm({ initialDetails: { name: "Alice", homeWorld: "Odin" } });

      expect(noteField().value).toBe("");
    });
  });

  describe("submitting", () => {
    it("should submit the details as entered", async () => {
      const onSubmit = renderForm();

      fillIn({ name: "Alice", homeWorld: "Tonberry", note: "Crafter" });
      fireEvent.click(submitButton());

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          name: "Alice",
          homeWorld: "Tonberry",
          note: "Crafter",
        }),
      );
    });

    it("should not submit until a name is given", () => {
      const onSubmit = renderForm();

      fillIn({ homeWorld: "Raiden" });
      fireEvent.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should not submit until a home world is chosen", () => {
      const onSubmit = renderForm();

      fillIn({ name: "Alice" });
      fireEvent.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("when the change is made", () => {
    it("should clear the form, ready for the next entry", async () => {
      renderForm();

      fillIn({ name: "Alice", homeWorld: "Raiden", note: "Crafter" });
      fireEvent.click(submitButton());

      await waitFor(() =>
        expect(fieldValues()).toEqual({ name: "", homeWorld: "", note: "" }),
      );
    });

    it("should no longer explain an earlier refusal", async () => {
      const onSubmit = vi
        .fn<(details: CharacterDetails) => Promise<RosterChangeResult>>()
        .mockResolvedValueOnce({ ok: false, error: { reason: "missing-name" } })
        .mockResolvedValueOnce(succeeds());
      renderForm({ onSubmit });
      fillIn({ name: " ", homeWorld: "Raiden" });
      fireEvent.click(submitButton());
      await screen.findByRole("alert");

      fillIn({ name: "Alice" });
      fireEvent.click(submitButton());

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });
  });

  describe("when the change is refused", () => {
    const refuse = async (): Promise<RosterChangeResult> => ({
      ok: false,
      error: { reason: "duplicate-character", name: "Alice", world: "Raiden" },
    });

    it("should explain why", async () => {
      renderForm({ onSubmit: refuse });

      fillIn({ name: "Alice", homeWorld: "Raiden" });
      fireEvent.click(submitButton());

      expect((await screen.findByRole("alert")).textContent).toBe(
        "There's already a character named Alice on Raiden.",
      );
    });

    it("should keep the details as entered, so they can be corrected", async () => {
      renderForm({ onSubmit: refuse });

      fillIn({ name: "Alice", homeWorld: "Raiden", note: "Crafter" });
      fireEvent.click(submitButton());
      await screen.findByRole("alert");

      expect(fieldValues()).toEqual({
        name: "Alice",
        homeWorld: "Raiden",
        note: "Crafter",
      });
    });
  });

  describe("cancelling", () => {
    it("should offer no way to cancel when cancelling isn't supported", () => {
      renderForm();

      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    });

    it("should report the cancellation without submitting anything", () => {
      const onCancel = vi.fn();
      const onSubmit = renderForm({ onCancel });

      fillIn({ name: "Alice", homeWorld: "Raiden" });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
