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
import { AddCharacterContainer } from "./AddCharacterContainer";

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

/** Reads the roster the way the app does, so the page can check it. */
const AddCharacterPage = () => {
  const [characters, reload] = useReloadable(() =>
    characterService.getCharacters(),
  );
  return characters ? (
    <AddCharacterContainer
      characters={characters}
      regions={referenceData.regions}
      onCharactersChanged={() => {
        onCharactersChanged();
        reload();
      }}
    />
  ) : null;
};

/** The page, alongside a stand-in for the roster it goes back to. */
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/characters/new"]}>
      <Routes>
        <Route path="/characters" element={<p>Characters page</p>} />
        <Route path="/characters/new" element={<AddCharacterPage />} />
      </Routes>
    </MemoryRouter>,
  );

const findAddForm = () =>
  screen.findByRole("form", { name: "Add a character" });

const fillIn = (form: HTMLElement, fields: Record<string, string>) =>
  Object.entries(fields).forEach(([label, value]) =>
    fireEvent.change(within(form).getByLabelText(label), {
      target: { value },
    }),
  );

const waitForRosterPage = () => screen.findByText("Characters page");

describe("AddCharacterContainer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    onCharactersChanged.mockReset();
    vi.restoreAllMocks();
  });

  it("should start with an empty form under the page's heading", async () => {
    renderPage();
    const form = await findAddForm();

    screen.getByRole("heading", { name: "Add a Character" });
    expect(
      (within(form).getByLabelText("Name") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (within(form).getByLabelText("Home world") as HTMLSelectElement).value,
    ).toBe("");
  });

  it("should add the entered character and go back to the roster, reporting the change", async () => {
    renderPage();
    const form = await findAddForm();

    fillIn(form, { Name: "Alice", "Home world": "Raiden", Note: "Main" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Add character" }),
    );

    await waitForRosterPage();
    expect(await characterService.getCharacters()).toEqual([
      {
        id: expect.any(String),
        name: "Alice",
        homeWorld: "Raiden",
        note: "Main",
        retainers: [],
      },
    ]);
    expect(onCharactersChanged).toHaveBeenCalled();
  });

  it("should stay put explaining a character the roster wouldn't take, adding nothing", async () => {
    await characterService.addCharacter({ name: "Alice", homeWorld: "Raiden" });
    renderPage();
    const form = await findAddForm();

    fillIn(form, { Name: "Alice", "Home world": "Raiden" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Add character" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "There's already a character named Alice on Raiden.",
    );
    expect(screen.queryByText("Characters page")).toBeNull();
    expect(await characterService.getCharacters()).toHaveLength(1);
    expect(onCharactersChanged).not.toHaveBeenCalled();
  });

  it("should stay put saying something went wrong when adding fails outright", async () => {
    vi.spyOn(characterService, "addCharacter").mockRejectedValue(
      new Error("storage is full"),
    );
    renderPage();
    const form = await findAddForm();

    fillIn(form, { Name: "Alice", "Home world": "Raiden" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Add character" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Something went wrong. Try again shortly.",
    );
    expect(screen.queryByText("Characters page")).toBeNull();
  });

  it.each(["Cancel", "Back to characters"])(
    "should go back to the roster adding nothing when %s is used",
    async (control) => {
      renderPage();
      const form = await findAddForm();
      fillIn(form, { Name: "Alice", "Home world": "Raiden" });

      fireEvent.click(screen.getByText(control));

      await waitForRosterPage();
      expect(await characterService.getCharacters()).toEqual([]);
      expect(onCharactersChanged).not.toHaveBeenCalled();
    },
  );
});
