// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useCallback, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Character, TradingParameters } from "../types";

// The real localStorage implementation, checked against a small directory instead of the real one.
vi.mock("../services/characterService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/characterService")>();
  return {
    ...actual,
    characterService: new actual.LocalStorageCharacterService([], {
      getRegions: async () => [
        {
          name: "Europe",
          dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
        },
      ],
      getMarketBoardCities: async () => ["Ul'dah", "Kugane"],
    }),
  };
});

import { characterService } from "../services/characterService";
import { buildTradingConfig } from "../services/tradingConfig";
import { CharactersContainer } from "./CharactersContainer";

const loadedConfig = {
  trackedItems: [],
  regions: [
    {
      name: "Europe",
      dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
    },
  ],
  marketBoardCities: ["Ul'dah", "Kugane"],
  params: {} as TradingParameters,
};

/** Reads the roster again whenever the page reports a change, the way the app does. */
const CharactersPage = () => {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const reload = useCallback(() => {
    characterService.getCharacters().then(setCharacters);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  return characters ? (
    <CharactersContainer
      config={buildTradingConfig(loadedConfig, characters)}
      onCharactersChanged={reload}
    />
  ) : null;
};

const renderPage = async () => {
  render(<CharactersPage />);
  return screen.findByRole("heading", { name: "Characters" });
};

const characterCard = (name: string) => screen.findByRole("region", { name });

const fillIn = (
  container: HTMLElement,
  fields: Record<string, string>,
): void => {
  Object.entries(fields).forEach(([label, value]) =>
    fireEvent.change(within(container).getByLabelText(label), {
      target: { value },
    }),
  );
};

const addCharacterThroughPage = async (name: string, homeWorld: string) => {
  const form = screen.getByRole("region", { name: "Add a character" });
  fillIn(form, { Name: name, "Home world": homeWorld });
  fireEvent.click(within(form).getByRole("button", { name: "Add character" }));
  return characterCard(name);
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CharactersContainer", () => {
  it("should say when there are no characters yet", async () => {
    await renderPage();

    expect(screen.getByText(/No characters yet/)).toBeTruthy();
  });

  describe("adding a character", () => {
    it("should add the character to the roster, showing its home world and region", async () => {
      await renderPage();

      const card = await addCharacterThroughPage("Alice", "Raiden");

      expect(within(card).getByText("Raiden (Europe)")).toBeTruthy();
      expect(await characterService.getCharacters()).toHaveLength(1);
    });

    it("should clear the form, ready for the next character", async () => {
      await renderPage();

      await addCharacterThroughPage("Alice", "Raiden");

      const form = screen.getByRole("region", { name: "Add a character" });
      expect(
        (within(form).getByLabelText("Name") as HTMLInputElement).value,
      ).toBe("");
    });

    it("should explain why a character couldn't be added", async () => {
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await renderPage();

      const form = screen.getByRole("region", { name: "Add a character" });
      fillIn(form, { Name: "Alice", "Home world": "Raiden" });
      fireEvent.click(
        within(form).getByRole("button", { name: "Add character" }),
      );

      expect((await within(form).findByRole("alert")).textContent).toBe(
        "There's already a character named Alice on Raiden.",
      );
    });
  });

  describe("changing a character", () => {
    it("should save the changed details", async () => {
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await renderPage();
      const card = await characterCard("Alice");

      fireEvent.click(within(card).getByRole("button", { name: "Edit Alice" }));
      fillIn(card, { Name: "Alicia", "Home world": "Odin", Note: "Moved" });
      fireEvent.click(
        within(card).getByRole("button", { name: "Save character" }),
      );

      const changed = await characterCard("Alicia");
      expect(within(changed).getByText("Odin (Europe)")).toBeTruthy();
      expect(within(changed).getByText("Moved")).toBeTruthy();
    });

    it("should keep the form open, explaining why, when the change can't be saved", async () => {
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await characterService.addCharacter({ name: "Bob", homeWorld: "Raiden" });
      await renderPage();
      const card = await characterCard("Bob");

      fireEvent.click(within(card).getByRole("button", { name: "Edit Bob" }));
      fillIn(card, { Name: "Alice" });
      fireEvent.click(
        within(card).getByRole("button", { name: "Save character" }),
      );

      expect((await within(card).findByRole("alert")).textContent).toBe(
        "There's already a character named Alice on Raiden.",
      );
      expect(
        within(card).getByRole("button", { name: "Save character" }),
      ).toBeTruthy();
    });

    it("should leave the character as it was when editing is cancelled", async () => {
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await renderPage();
      const card = await characterCard("Alice");

      fireEvent.click(within(card).getByRole("button", { name: "Edit Alice" }));
      fillIn(card, { Name: "Alicia" });
      fireEvent.click(within(card).getByRole("button", { name: "Cancel" }));

      expect(within(card).getByRole("heading", { level: 2 }).textContent).toBe(
        "Alice Raiden (Europe)",
      );
      expect((await characterService.getCharacters())[0].name).toBe("Alice");
    });
  });

  describe("removing a character", () => {
    it("should remove the character once it's confirmed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await renderPage();

      fireEvent.click(
        within(await characterCard("Alice")).getByRole("button", {
          name: "Remove Alice",
        }),
      );

      await screen.findByText(/No characters yet/);
      expect(await characterService.getCharacters()).toEqual([]);
    });

    it("should keep the character when removing it isn't confirmed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const removeCharacter = vi.spyOn(characterService, "removeCharacter");
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await renderPage();

      fireEvent.click(
        within(await characterCard("Alice")).getByRole("button", {
          name: "Remove Alice",
        }),
      );

      expect(removeCharacter).not.toHaveBeenCalled();
    });
  });

  describe("managing retainers", () => {
    const addRetainerThroughPage = (
      card: HTMLElement,
      name: string,
      city: string,
    ) => {
      const form = within(card)
        .getByRole("button", { name: "Add retainer" })
        .closest("form")!;
      fillIn(form, { "Retainer name": name, City: city });
      fireEvent.click(
        within(form).getByRole("button", { name: "Add retainer" }),
      );
      return form;
    };

    it("should add a retainer to only that character", async () => {
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await characterService.addCharacter({ name: "Bob", homeWorld: "Odin" });
      await renderPage();

      addRetainerThroughPage(await characterCard("Alice"), "Amarana", "Ul'dah");

      await within(await characterCard("Alice")).findByText("Amarana");
      expect(
        within(await characterCard("Bob")).getByText("No retainers yet."),
      ).toBeTruthy();
    });

    it("should explain why a retainer couldn't be added", async () => {
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await renderPage();
      const card = await characterCard("Alice");
      addRetainerThroughPage(card, "Amarana", "Ul'dah");
      await within(card).findByText("Amarana");

      const form = addRetainerThroughPage(card, "Amarana", "Kugane");

      expect((await within(form).findByRole("alert")).textContent).toBe(
        "This character already has a retainer named Amarana.",
      );
    });

    it("should save a retainer's changed details", async () => {
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await renderPage();
      const card = await characterCard("Alice");
      addRetainerThroughPage(card, "Amarana", "Ul'dah");

      fireEvent.click(
        await within(card).findByRole("button", { name: "Edit Amarana" }),
      );
      const [editForm] = within(card)
        .getAllByRole("button", { name: "Save retainer" })
        .map((button) => button.closest("form")!);
      fillIn(editForm, { City: "Kugane" });
      fireEvent.click(
        within(editForm).getByRole("button", { name: "Save retainer" }),
      );

      await within(card).findByText("in Kugane");
    });

    it("should remove a retainer", async () => {
      await characterService.addCharacter({
        name: "Alice",
        homeWorld: "Raiden",
      });
      await renderPage();
      const card = await characterCard("Alice");
      addRetainerThroughPage(card, "Amarana", "Ul'dah");

      fireEvent.click(
        await within(card).findByRole("button", { name: "Remove Amarana" }),
      );

      await within(card).findByText("No retainers yet.");
    });
  });
});
