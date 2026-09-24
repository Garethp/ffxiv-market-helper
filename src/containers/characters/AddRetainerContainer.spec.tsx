// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { AddRetainerContainer } from "./AddRetainerContainer";

const referenceData = {
  regions: [
    {
      name: "Europe",
      dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
    },
  ],
  marketBoardCities: ["Ul'dah", "Kugane"],
};

const onCharactersChanged = vi.fn();

/** Reads the roster the way the app does, so the page can find the character and check it. */
const AddRetainerPage = () => {
  const [characters, reload] = useReloadable(() =>
    characterService.getCharacters(),
  );
  return characters ? (
    <AddRetainerContainer
      characters={characters}
      marketBoardCities={referenceData.marketBoardCities}
      onCharactersChanged={() => {
        onCharactersChanged();
        reload();
      }}
    />
  ) : null;
};

/** Adds a character and returns its ID, so there's someone to add a retainer to. */
const add = async (name: string) => {
  await characterService.addCharacter({ name, homeWorld: "Raiden" });
  const characters = await characterService.getCharacters();
  return characters[characters.length - 1].id;
};

const readRetainersOf = async (characterId: string) =>
  (await characterService.getCharacters()).find(({ id }) => id === characterId)!
    .retainers;

/** The page for one character, alongside a stand-in for the roster it goes back to. */
const renderPage = (characterId: string) =>
  render(
    <MemoryRouter initialEntries={[`/characters/${characterId}/retainers/new`]}>
      <Routes>
        <Route path="/characters" element={<p>Characters page</p>} />
        <Route
          path="/characters/:characterId/retainers/new"
          element={<AddRetainerPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

/** The page's form, once the character it's for has been read. */
const findAddForm = () => screen.findByRole("form");

const fillIn = (form: HTMLElement, fields: Record<string, string>) =>
  Object.entries(fields).forEach(([label, value]) =>
    fireEvent.change(within(form).getByLabelText(label), {
      target: { value },
    }),
  );

const waitForRosterPage = () => screen.findByText("Characters page");

describe("AddRetainerContainer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    onCharactersChanged.mockReset();
    vi.restoreAllMocks();
  });

  it("should name the character the retainer is for", async () => {
    const id = await add("Alice");

    renderPage(id);
    const form = await findAddForm();

    screen.getByRole("heading", { name: "Add a Retainer for Alice" });
    expect(form.getAttribute("aria-label")).toBe("Add a retainer for Alice");
  });

  it("should add the entered retainer to only that character and go back to the roster, reporting the change", async () => {
    const aliceId = await add("Alice");
    const bobId = await add("Bob");
    renderPage(aliceId);
    const form = await findAddForm();

    fillIn(form, { "Retainer name": "Amarana", City: "Ul'dah" });
    fireEvent.click(within(form).getByRole("button", { name: "Add retainer" }));

    await waitForRosterPage();
    expect(await readRetainersOf(aliceId)).toEqual([
      { id: expect.any(String), name: "Amarana", city: "Ul'dah" },
    ]);
    expect(await readRetainersOf(bobId)).toEqual([]);
    expect(onCharactersChanged).toHaveBeenCalled();
  });

  it("should stay put explaining a retainer the character wouldn't take, adding nothing", async () => {
    const id = await add("Alice");
    await characterService.addRetainer(id, { name: "Amarana", city: "Ul'dah" });
    renderPage(id);
    const form = await findAddForm();

    fillIn(form, { "Retainer name": "Amarana", City: "Kugane" });
    fireEvent.click(within(form).getByRole("button", { name: "Add retainer" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This character already has a retainer named Amarana.",
    );
    expect(screen.queryByText("Characters page")).toBeNull();
    expect(await readRetainersOf(id)).toHaveLength(1);
    expect(onCharactersChanged).not.toHaveBeenCalled();
  });

  it("should stay put saying something went wrong when adding fails outright", async () => {
    const id = await add("Alice");
    vi.spyOn(characterService, "addRetainer").mockRejectedValue(
      new Error("storage is full"),
    );
    renderPage(id);
    const form = await findAddForm();

    fillIn(form, { "Retainer name": "Amarana", City: "Ul'dah" });
    fireEvent.click(within(form).getByRole("button", { name: "Add retainer" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Something went wrong. Try again shortly.",
    );
    expect(screen.queryByText("Characters page")).toBeNull();
  });

  it.each(["Cancel", "Back to characters"])(
    "should go back to the roster adding nothing when %s is used",
    async (control) => {
      const id = await add("Alice");
      renderPage(id);
      const form = await findAddForm();
      fillIn(form, { "Retainer name": "Amarana", City: "Ul'dah" });

      fireEvent.click(screen.getByText(control));

      await waitForRosterPage();
      expect(await readRetainersOf(id)).toEqual([]);
      expect(onCharactersChanged).not.toHaveBeenCalled();
    },
  );

  it("should go straight back to the roster when the character isn't in it", async () => {
    renderPage("never-added");

    await waitForRosterPage();
    expect(screen.queryByRole("form")).toBeNull();
  });
});
