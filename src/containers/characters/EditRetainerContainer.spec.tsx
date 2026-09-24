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
import type { Character } from "../../types";

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
import { EditRetainerContainer } from "./EditRetainerContainer";

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

/** Reads the roster the way the app does, so the page can find the retainer being changed. */
const EditRetainerPage = () => {
  const [characters, reload] = useReloadable(() =>
    characterService.getCharacters(),
  );
  return characters ? (
    <EditRetainerContainer
      characters={characters}
      marketBoardCities={referenceData.marketBoardCities}
      onCharactersChanged={() => {
        onCharactersChanged();
        reload();
      }}
    />
  ) : null;
};

/** Adds Alice with the named retainers, all in Ul'dah, and returns her as saved. */
const addAliceWithRetainers = async (
  ...names: string[]
): Promise<Character> => {
  await characterService.addCharacter({ name: "Alice", homeWorld: "Raiden" });
  const [alice] = await characterService.getCharacters();
  for (const name of names) {
    await characterService.addRetainer(alice.id, { name, city: "Ul'dah" });
  }
  const [saved] = await characterService.getCharacters();
  return saved;
};

const savedRetainers = async () =>
  (await characterService.getCharacters())[0].retainers;

/** The page for one retainer, alongside a stand-in for the roster it goes back to. */
const renderPage = (characterId: string, retainerId: string) =>
  render(
    <MemoryRouter
      initialEntries={[
        `/characters/${characterId}/retainers/${retainerId}/edit`,
      ]}
    >
      <Routes>
        <Route path="/characters" element={<p>Characters page</p>} />
        <Route
          path="/characters/:characterId/retainers/:retainerId/edit"
          element={<EditRetainerPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

/** The page's form, once the retainer it's for has been read. */
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

describe("EditRetainerContainer", () => {
  it("should name the retainer and start with its current details", async () => {
    const alice = await addAliceWithRetainers("Amarana");

    renderPage(alice.id, alice.retainers[0].id);
    const form = await editForm();

    screen.getByRole("heading", { name: "Edit Amarana" });
    expect(fieldValue(form, "Retainer name")).toBe("Amarana");
    expect(fieldValue(form, "City")).toBe("Ul'dah");
  });

  it("should save the entered details for only that retainer and go back to the roster, reporting the change", async () => {
    const alice = await addAliceWithRetainers("Amarana", "Bertrand");
    const [amarana, bertrand] = alice.retainers;
    renderPage(alice.id, bertrand.id);
    const form = await editForm();

    fillIn(form, { "Retainer name": "Bertie", City: "Kugane" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save retainer" }),
    );

    await backOnTheRoster();
    expect(await savedRetainers()).toEqual([
      amarana,
      { id: bertrand.id, name: "Bertie", city: "Kugane" },
    ]);
    expect(onCharactersChanged).toHaveBeenCalled();
  });

  it("should let the retainer keep its own name", async () => {
    const alice = await addAliceWithRetainers("Amarana");
    renderPage(alice.id, alice.retainers[0].id);
    const form = await editForm();

    fillIn(form, { City: "Kugane" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save retainer" }),
    );

    await backOnTheRoster();
    expect((await savedRetainers())[0].city).toBe("Kugane");
  });

  it("should stay put explaining details the character wouldn't take, saving nothing", async () => {
    const alice = await addAliceWithRetainers("Amarana", "Bertrand");
    renderPage(alice.id, alice.retainers[1].id);
    const form = await editForm();

    fillIn(form, { "Retainer name": "Amarana" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save retainer" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This character already has a retainer named Amarana.",
    );
    expect(screen.queryByText("Characters page")).toBeNull();
    expect(await savedRetainers()).toEqual(alice.retainers);
    expect(onCharactersChanged).not.toHaveBeenCalled();
  });

  it("should stay put saying something went wrong when saving fails outright", async () => {
    const alice = await addAliceWithRetainers("Amarana");
    vi.spyOn(characterService, "updateRetainer").mockRejectedValue(
      new Error("storage is full"),
    );
    renderPage(alice.id, alice.retainers[0].id);
    const form = await editForm();

    fillIn(form, { City: "Kugane" });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save retainer" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Something went wrong. Try again shortly.",
    );
    expect(screen.queryByText("Characters page")).toBeNull();
  });

  it.each(["Cancel", "Back to characters"])(
    "should go back to the roster changing nothing when %s is used",
    async (control) => {
      const alice = await addAliceWithRetainers("Amarana");
      renderPage(alice.id, alice.retainers[0].id);
      const form = await editForm();
      fillIn(form, { City: "Kugane" });

      fireEvent.click(screen.getByText(control));

      await backOnTheRoster();
      expect(await savedRetainers()).toEqual(alice.retainers);
      expect(onCharactersChanged).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["the character isn't in the roster", "never-added", "any"],
    ["the character has no such retainer", null, "never-added"],
  ])(
    "should go straight back to the roster when %s",
    async (_, characterId, retainerId) => {
      const alice = await addAliceWithRetainers("Amarana");

      renderPage(characterId ?? alice.id, retainerId);

      await backOnTheRoster();
      expect(screen.queryByRole("form")).toBeNull();
    },
  );
});
