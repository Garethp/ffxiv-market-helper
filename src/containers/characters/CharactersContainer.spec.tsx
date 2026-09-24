// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Character, RegionInfo } from "../../types";

// The real localStorage implementation, checked against a small directory instead of the real one.
vi.mock("../../services/characterService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/characterService")>();
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

import { useReloadable } from "../../hooks/useReloadable";
import { characterService } from "../../services/characterService";
import { CharactersContainer } from "./CharactersContainer";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
  },
];

const loadCharacters = () => characterService.getCharacters();

/** Reads the roster again whenever the page reports a change, the way the app does. */
const CharactersPage = () => {
  const [characters, reload] = useReloadable(loadCharacters);

  return characters ? (
    <CharactersContainer
      characters={characters}
      regions={regions}
      onCharactersChanged={reload}
    />
  ) : null;
};

const renderPage = async () => {
  render(
    <MemoryRouter>
      <CharactersPage />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Characters" });
};

const characterCard = (name: string) => screen.findByRole("region", { name });

/** Adds Alice with a retainer, Amarana, and returns her as saved. */
const addAliceWithAmarana = async (): Promise<Character> => {
  await characterService.addCharacter({ name: "Alice", homeWorld: "Raiden" });
  const [alice] = await characterService.getCharacters();
  await characterService.addRetainer(alice.id, {
    name: "Amarana",
    city: "Ul'dah",
  });
  const [saved] = await characterService.getCharacters();
  return saved;
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
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("should show each character with its retainers", async () => {
    await addAliceWithAmarana();
    await characterService.addCharacter({ name: "Bob", homeWorld: "Odin" });
    await renderPage();

    const alice = await characterCard("Alice");
    expect(within(alice).getByText("Raiden (Europe)")).toBeTruthy();
    expect(within(alice).getByText("Amarana")).toBeTruthy();
    const bob = await characterCard("Bob");
    expect(within(bob).getByText("No retainers yet.")).toBeTruthy();
  });

  describe("leading to the pages for changing the roster", () => {
    it("should lead to the page for adding a character", async () => {
      await renderPage();

      expect(
        screen
          .getByRole("link", { name: "Add a character" })
          .getAttribute("href"),
      ).toBe("/characters/new");
    });

    it("should lead to each character's and retainer's own pages", async () => {
      const alice = await addAliceWithAmarana();
      const [amarana] = alice.retainers;
      await renderPage();
      const card = await characterCard("Alice");

      const hrefOf = (name: string) =>
        within(card).getByRole("link", { name }).getAttribute("href");
      expect(hrefOf("Edit Alice")).toBe(`/characters/${alice.id}/edit`);
      expect(hrefOf("Add a retainer for Alice")).toBe(
        `/characters/${alice.id}/retainers/new`,
      );
      expect(hrefOf("Edit Amarana")).toBe(
        `/characters/${alice.id}/retainers/${amarana.id}/edit`,
      );
    });
  });

  describe("removing a character", () => {
    it("should remove the character once it's confirmed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await addAliceWithAmarana();
      await renderPage();

      fireEvent.click(
        within(await characterCard("Alice")).getByRole("button", {
          name: "Remove Alice",
        }),
      );

      await screen.findByText(/No characters yet/);
      expect(await characterService.getCharacters()).toEqual([]);
    });
  });

  describe("removing a retainer", () => {
    it("should remove the retainer", async () => {
      await addAliceWithAmarana();
      await renderPage();
      const card = await characterCard("Alice");

      fireEvent.click(
        within(card).getByRole("button", { name: "Remove Amarana" }),
      );

      await within(card).findByText("No retainers yet.");
      const [alice] = await characterService.getCharacters();
      expect(alice.retainers).toEqual([]);
    });
  });

  describe("when a removal fails", () => {
    it.each([
      ["a character", "removeCharacter", "Remove Alice"],
      ["a retainer", "removeRetainer", "Remove Amarana"],
    ] as const)(
      "should say something went wrong at the top of the page when %s couldn't be removed",
      async (_, method, removeButtonName) => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.spyOn(characterService, method).mockRejectedValue(
          new Error("storage is full"),
        );
        await addAliceWithAmarana();
        await renderPage();

        fireEvent.click(
          within(await characterCard("Alice")).getByRole("button", {
            name: removeButtonName,
          }),
        );

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toBe(
          "Something went wrong. Try again shortly.",
        );
        expect(alert.closest("section")).toBeNull();
      },
    );

    it("should clear the error once another change is tried", async () => {
      vi.spyOn(characterService, "removeRetainer").mockRejectedValueOnce(
        new Error("storage is full"),
      );
      await addAliceWithAmarana();
      await renderPage();
      const card = await characterCard("Alice");
      const remove = () =>
        fireEvent.click(
          within(card).getByRole("button", { name: "Remove Amarana" }),
        );

      remove();
      await screen.findByRole("alert");
      remove();

      await within(card).findByText("No retainers yet.");
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
