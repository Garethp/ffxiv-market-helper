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
import {
  characterService,
  type CharacterDetails,
} from "../../services/characterService";
import { EditCharacterContainer } from "./EditCharacterContainer";

const referenceData = {
  regions: [
    {
      name: "Europe",
      dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
    },
  ],
  marketBoardCities: ["Ul'dah", "Kugane"],
};

const alice: CharacterDetails = { name: "Alice", homeWorld: "Raiden" };

const onCharactersChanged = vi.fn();

/** Reads the roster the way the app does, so the page can find the character being changed. */
const EditCharacterPage = () => {
  const [characters, reload] = useReloadable(() =>
    characterService.getCharacters(),
  );
  return characters ? (
    <EditCharacterContainer
      characters={characters}
      regions={referenceData.regions}
      onCharactersChanged={() => {
        onCharactersChanged();
        reload();
      }}
    />
  ) : null;
};

/** Adds the character and returns its ID, so there's something to change. */
const add = async (details: CharacterDetails = alice) => {
  await characterService.addCharacter(details);
  const characters = await characterService.getCharacters();
  return characters[characters.length - 1].id;
};

/** The page for one character, alongside a stand-in for the roster it goes back to. */
const renderPage = (characterId: string) =>
  render(
    <MemoryRouter initialEntries={[`/characters/${characterId}/edit`]}>
      <Routes>
        <Route path="/characters" element={<p>Characters page</p>} />
        <Route
          path="/characters/:characterId/edit"
          element={<EditCharacterPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

/** The page's form, once the character it's for has been read. */
const editForm = () => screen.findByRole("form");

const fieldValue = (form: HTMLElement, label: string) =>
  (within(form).getByLabelText(label) as HTMLInputElement).value;

const fillIn = (form: HTMLElement, fields: Record<string, string>) =>
  Object.entries(fields).forEach(([label, value]) =>
    fireEvent.change(within(form).getByLabelText(label), {
      target: { value },
    }),
  );

const backOnTheRoster = () => screen.findByText("Characters page");

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  onCharactersChanged.mockReset();
  vi.restoreAllMocks();
});

describe("EditCharacterContainer", () => {
  it("should name the character and start with its current details", async () => {
    const id = await add({ ...alice, note: "Main" });

    renderPage(id);
    const form = await editForm();

    screen.getByRole("heading", { name: "Edit Alice" });
    expect(fieldValue(form, "Name")).toBe("Alice");
    expect(fieldValue(form, "Home world")).toBe("Raiden");
    expect(fieldValue(form, "Note")).toBe("Main");
  });

  it("should save the entered details and go back to the roster, reporting the change", async () => {
    const id = await add();
    await characterService.addRetainer(id, { name: "Amarana", city: "Ul'dah" });
    renderPage(id);
    const form = await editForm();

    fillIn(form, { Name: "Alicia", "Home world": "Odin", Note: "Moved" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save character" }),
    );

    await backOnTheRoster();
    const [changed] = await characterService.getCharacters();
    expect(changed).toMatchObject({
      id,
      name: "Alicia",
      homeWorld: "Odin",
      note: "Moved",
      retainers: [{ name: "Amarana", city: "Ul'dah" }],
    });
    expect(onCharactersChanged).toHaveBeenCalled();
  });

  it("should let the character keep its own name and world", async () => {
    const id = await add();
    renderPage(id);
    const form = await editForm();

    fillIn(form, { Note: "Crafter" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save character" }),
    );

    await backOnTheRoster();
    const [changed] = await characterService.getCharacters();
    expect(changed.note).toBe("Crafter");
  });

  it("should stay put explaining details the roster wouldn't take, saving nothing", async () => {
    await add();
    const bobId = await add({ name: "Bob", homeWorld: "Raiden" });
    renderPage(bobId);
    const form = await editForm();

    fillIn(form, { Name: "Alice" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save character" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "There's already a character named Alice on Raiden.",
    );
    expect(screen.queryByText("Characters page")).toBeNull();
    const [, bob] = await characterService.getCharacters();
    expect(bob.name).toBe("Bob");
    expect(onCharactersChanged).not.toHaveBeenCalled();
  });

  it("should stay put saying something went wrong when saving fails outright", async () => {
    const id = await add();
    vi.spyOn(characterService, "updateCharacter").mockRejectedValue(
      new Error("storage is full"),
    );
    renderPage(id);
    const form = await editForm();

    fillIn(form, { Note: "Crafter" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save character" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Something went wrong. Try again shortly.",
    );
    expect(screen.queryByText("Characters page")).toBeNull();
  });

  it.each(["Cancel", "Back to characters"])(
    "should go back to the roster changing nothing when %s is used",
    async (control) => {
      const id = await add();
      renderPage(id);
      const form = await editForm();
      fillIn(form, { Name: "Alicia" });

      fireEvent.click(screen.getByText(control));

      await backOnTheRoster();
      const [unchanged] = await characterService.getCharacters();
      expect(unchanged.name).toBe("Alice");
      expect(onCharactersChanged).not.toHaveBeenCalled();
    },
  );

  it("should go straight back to the roster when the character isn't in it", async () => {
    renderPage("never-added");

    await backOnTheRoster();
    expect(screen.queryByRole("form")).toBeNull();
  });
});
