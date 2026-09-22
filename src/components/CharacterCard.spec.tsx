// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CharacterDetails,
  RetainerDetails,
} from "../services/characterService";
import type { Character, RegionInfo } from "../types";
import { CharacterCard } from "./CharacterCard";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
  },
];

const marketBoardCities = ["Ul'dah", "Kugane"];

const saved = async (): Promise<void> => {};

const fails = () => Promise.reject(new Error("no storage"));

const aCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: "alice",
  name: "Alice",
  homeWorld: "Raiden",
  retainers: [],
  ...overrides,
});

const renderCard = (
  character: Character,
  {
    roster,
    ...handlers
  }: Partial<{
    /** The rest of the roster, when a test needs a name the character could clash with. */
    roster: Character[];
    onUpdate: (details: CharacterDetails) => Promise<void>;
    onRemove: () => Promise<void>;
    onAddRetainer: (details: RetainerDetails) => Promise<void>;
    onUpdateRetainer: (
      retainerId: string,
      details: RetainerDetails,
    ) => Promise<void>;
    onRemoveRetainer: (retainerId: string) => Promise<void>;
  }> = {},
) => {
  return render(
    <CharacterCard
      character={character}
      roster={roster ?? [character]}
      regions={regions}
      marketBoardCities={marketBoardCities}
      onUpdate={saved}
      onRemove={saved}
      onAddRetainer={saved}
      onUpdateRetainer={saved}
      onRemoveRetainer={saved}
      {...handlers}
    />,
  );
};

/** The form whose submit button carries this label. */
const formFor = (submitLabel: string) =>
  screen.getByRole("button", { name: submitLabel }).closest("form")!;

const fillIn = (container: HTMLElement, fields: Record<string, string>) =>
  Object.entries(fields).forEach(([label, value]) =>
    fireEvent.change(within(container).getByLabelText(label), {
      target: { value },
    }),
  );

const valueOf = (container: HTMLElement, label: string) =>
  (within(container).getByLabelText(label) as HTMLInputElement).value;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CharacterCard", () => {
  describe("showing the character", () => {
    it("should show the character's name, home world and region", () => {
      renderCard(aCharacter({ name: "Alice", homeWorld: "Odin" }));

      expect(
        screen.getByRole("heading", { level: 2, name: "Alice Odin (Europe)" }),
      ).toBeTruthy();
    });

    it("should say the region is unknown when the home world isn't in the directory", () => {
      renderCard(aCharacter({ homeWorld: "Nowhere" }));

      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "Alice Nowhere (Unknown region)",
        }),
      ).toBeTruthy();
    });

    it("should show the character's note", () => {
      renderCard(aCharacter({ note: "Needs a manual meetup" }));

      expect(screen.getByText("Needs a manual meetup")).toBeTruthy();
    });
  });

  describe("showing the retainers", () => {
    it("should list each retainer with the city it's in", () => {
      renderCard(
        aCharacter({
          retainers: [
            { id: "r1", name: "Amarana", city: "Ul'dah" },
            { id: "r2", name: "Bertrand", city: "Kugane" },
          ],
        }),
      );

      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      expect(
        within(screen.getByText("Amarana")).getByText("in Ul'dah"),
      ).toBeTruthy();
      expect(
        within(screen.getByText("Bertrand")).getByText("in Kugane"),
      ).toBeTruthy();
    });

    it("should say when the character has no retainers yet", () => {
      renderCard(aCharacter({ retainers: [] }));

      expect(screen.getByText("No retainers yet.")).toBeTruthy();
      expect(screen.queryAllByRole("listitem")).toEqual([]);
    });
  });

  describe("editing the character", () => {
    it("should open a form filled in with the character's current details", () => {
      renderCard(aCharacter({ homeWorld: "Odin", note: "Moved" }));

      fireEvent.click(screen.getByRole("button", { name: "Edit Alice" }));

      const form = formFor("Save character");
      expect(valueOf(form, "Name")).toBe("Alice");
      expect(valueOf(form, "Home world")).toBe("Odin");
      expect(valueOf(form, "Note")).toBe("Moved");
    });

    it("should save the entered details and close the form once they're saved", async () => {
      const onUpdate = vi.fn(saved);
      renderCard(aCharacter(), { onUpdate });

      fireEvent.click(screen.getByRole("button", { name: "Edit Alice" }));
      const form = formFor("Save character");
      fillIn(form, { Name: "Alicia", "Home world": "Odin", Note: "Moved" });
      fireEvent.click(
        within(form).getByRole("button", { name: "Save character" }),
      );

      await screen.findByRole("button", { name: "Edit Alice" });
      expect(onUpdate).toHaveBeenCalledWith({
        name: "Alicia",
        homeWorld: "Odin",
        note: "Moved",
      });
      expect(screen.queryByRole("button", { name: "Save character" })).toBe(
        null,
      );
    });

    it("should keep the form open, explaining why, when another character has that name and world", async () => {
      const alice = aCharacter();
      const bob = aCharacter({ id: "bob", name: "Bob" });
      const onUpdate = vi.fn(saved);
      renderCard(alice, { roster: [alice, bob], onUpdate });

      fireEvent.click(screen.getByRole("button", { name: "Edit Alice" }));
      const form = formFor("Save character");
      fillIn(form, { Name: "Bob" });
      fireEvent.click(
        within(form).getByRole("button", { name: "Save character" }),
      );

      expect((await screen.findByRole("alert")).textContent).toBe(
        "There's already a character named Bob on Raiden.",
      );
      expect(
        screen.getByRole("button", { name: "Save character" }),
      ).toBeTruthy();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("should let the character keep its own name and world", async () => {
      const alice = aCharacter();
      const onUpdate = vi.fn(saved);
      renderCard(alice, { roster: [alice], onUpdate });

      fireEvent.click(screen.getByRole("button", { name: "Edit Alice" }));
      const form = formFor("Save character");
      fillIn(form, { Note: "Crafter" });
      fireEvent.click(
        within(form).getByRole("button", { name: "Save character" }),
      );

      await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should say something went wrong when the details couldn't be saved", async () => {
      renderCard(aCharacter(), { onUpdate: fails });

      fireEvent.click(screen.getByRole("button", { name: "Edit Alice" }));
      const form = formFor("Save character");
      fillIn(form, { Note: "Crafter" });
      fireEvent.click(
        within(form).getByRole("button", { name: "Save character" }),
      );

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Something went wrong. Try again shortly.",
      );
    });

    it("should close the form without saving anything when editing is cancelled", () => {
      const onUpdate = vi.fn(saved);
      renderCard(aCharacter(), { onUpdate });

      fireEvent.click(screen.getByRole("button", { name: "Edit Alice" }));
      fillIn(formFor("Save character"), { Name: "Alicia" });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "Alice Raiden (Europe)",
        }),
      ).toBeTruthy();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("removing the character", () => {
    it("should remove the character once it's confirmed", () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const onRemove = vi.fn(saved);
      renderCard(aCharacter(), { onRemove });

      fireEvent.click(screen.getByRole("button", { name: "Remove Alice" }));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("should keep the character when removing it isn't confirmed", () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const onRemove = vi.fn(saved);
      renderCard(aCharacter(), { onRemove });

      fireEvent.click(screen.getByRole("button", { name: "Remove Alice" }));

      expect(onRemove).not.toHaveBeenCalled();
    });

    it("should say something went wrong when the character couldn't be removed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      renderCard(aCharacter(), { onRemove: fails });

      fireEvent.click(screen.getByRole("button", { name: "Remove Alice" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Something went wrong. Try again shortly.",
      );
    });
  });

  describe("adding a retainer", () => {
    it("should add a retainer with the entered details", async () => {
      const onAddRetainer = vi.fn(saved);
      renderCard(aCharacter(), { onAddRetainer });

      const form = formFor("Add retainer");
      fillIn(form, { "Retainer name": "Amarana", City: "Kugane" });
      fireEvent.click(
        within(form).getByRole("button", { name: "Add retainer" }),
      );

      await vi.waitFor(() =>
        expect(onAddRetainer).toHaveBeenCalledWith({
          name: "Amarana",
          city: "Kugane",
        }),
      );
    });
  });

  describe("editing a retainer", () => {
    const withRetainers = () =>
      aCharacter({
        retainers: [
          { id: "r1", name: "Amarana", city: "Ul'dah" },
          { id: "r2", name: "Bertrand", city: "Kugane" },
        ],
      });

    it("should open a form filled in with that retainer's current details", () => {
      renderCard(withRetainers());

      fireEvent.click(screen.getByRole("button", { name: "Edit Bertrand" }));

      const form = formFor("Save retainer");
      expect(valueOf(form, "Retainer name")).toBe("Bertrand");
      expect(valueOf(form, "City")).toBe("Kugane");
    });

    it("should keep showing the other retainers while one is being edited", () => {
      renderCard(withRetainers());

      fireEvent.click(screen.getByRole("button", { name: "Edit Bertrand" }));

      expect(screen.getByRole("button", { name: "Edit Amarana" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Edit Bertrand" })).toBe(
        null,
      );
    });

    it("should save the entered details for that retainer and close the form once they're saved", async () => {
      const onUpdateRetainer = vi.fn(saved);
      renderCard(withRetainers(), { onUpdateRetainer });

      fireEvent.click(screen.getByRole("button", { name: "Edit Bertrand" }));
      const form = formFor("Save retainer");
      fillIn(form, { "Retainer name": "Bertie", City: "Ul'dah" });
      fireEvent.click(
        within(form).getByRole("button", { name: "Save retainer" }),
      );

      await screen.findByRole("button", { name: "Edit Bertrand" });
      expect(onUpdateRetainer).toHaveBeenCalledWith("r2", {
        name: "Bertie",
        city: "Ul'dah",
      });
      expect(screen.queryByRole("button", { name: "Save retainer" })).toBe(
        null,
      );
    });

    it("should keep the form open, explaining why, when another retainer has that name", async () => {
      renderCard(withRetainers());

      fireEvent.click(screen.getByRole("button", { name: "Edit Bertrand" }));
      const form = formFor("Save retainer");
      fillIn(form, { "Retainer name": "Amarana" });
      fireEvent.click(
        within(form).getByRole("button", { name: "Save retainer" }),
      );

      expect((await screen.findByRole("alert")).textContent).toBe(
        "This character already has a retainer named Amarana.",
      );
      expect(
        screen.getByRole("button", { name: "Save retainer" }),
      ).toBeTruthy();
    });

    it("should close the form without saving anything when editing is cancelled", () => {
      const onUpdateRetainer = vi.fn(saved);
      renderCard(withRetainers(), { onUpdateRetainer });

      fireEvent.click(screen.getByRole("button", { name: "Edit Bertrand" }));
      fillIn(formFor("Save retainer"), { City: "Ul'dah" });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(
        within(screen.getByText("Bertrand")).getByText("in Kugane"),
      ).toBeTruthy();
      expect(onUpdateRetainer).not.toHaveBeenCalled();
    });
  });

  describe("removing a retainer", () => {
    it("should remove that retainer", () => {
      const onRemoveRetainer = vi.fn(saved);
      renderCard(
        aCharacter({
          retainers: [
            { id: "r1", name: "Amarana", city: "Ul'dah" },
            { id: "r2", name: "Bertrand", city: "Kugane" },
          ],
        }),
        { onRemoveRetainer },
      );

      fireEvent.click(screen.getByRole("button", { name: "Remove Bertrand" }));

      expect(onRemoveRetainer).toHaveBeenCalledWith("r2");
      expect(onRemoveRetainer).toHaveBeenCalledTimes(1);
    });

    it("should say something went wrong when the retainer couldn't be removed", async () => {
      renderCard(
        aCharacter({
          retainers: [{ id: "r1", name: "Amarana", city: "Ul'dah" }],
        }),
        { onRemoveRetainer: fails },
      );

      fireEvent.click(screen.getByRole("button", { name: "Remove Amarana" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Something went wrong. Try again shortly.",
      );
    });
  });
});
