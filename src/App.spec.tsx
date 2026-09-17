// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Character, TradingParameters } from "./types";

type PageProps = { currentCharacter: Character | null };

vi.mock("./services/tradingConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/tradingConfig")>()),
  loadConfig: vi.fn(),
}));
vi.mock("./services/characterService", () => ({
  characterService: { getCharacters: vi.fn() },
}));
vi.mock("./services/currentCharacterService", () => ({
  currentCharacterService: {
    getCurrentCharacterId: vi.fn(),
    setCurrentCharacterId: vi.fn(),
  },
}));
// Stand-ins that show which page is open and which character it was given.
vi.mock("./containers/TrackedItemsContainer", () => ({
  TrackedItemsContainer: ({ currentCharacter }: PageProps) => (
    <p>Tracked items selling as {currentCharacter?.name}</p>
  ),
}));
vi.mock("./containers/HighVolumeItemsContainer", () => ({
  HighVolumeItemsContainer: ({ currentCharacter }: PageProps) => (
    <p>High volume items for {currentCharacter?.name}</p>
  ),
}));
vi.mock("./containers/ItemProfitScanContainer", () => ({
  ItemProfitScanContainer: () => <p>Item profit scan</p>,
}));
vi.mock("./containers/CharactersContainer", () => ({
  CharactersContainer: ({
    onCharactersChanged,
  }: {
    onCharactersChanged: () => void;
  }) => (
    <button type="button" onClick={onCharactersChanged}>
      Change the roster
    </button>
  ),
}));

import App from "./App";
import { withQueryClient } from "./testing/withQueryClient";
import { characterService } from "./services/characterService";
import { currentCharacterService } from "./services/currentCharacterService";
import { loadConfig } from "./services/tradingConfig";

const mockedGetCharacters = vi.mocked(characterService.getCharacters);
const mockedGetCurrentCharacterId = vi.mocked(
  currentCharacterService.getCurrentCharacterId,
);
const mockedSetCurrentCharacterId = vi.mocked(
  currentCharacterService.setCurrentCharacterId,
);

const alice: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "WorldA",
  retainers: [],
};
const bob: Character = {
  id: "bob",
  name: "Bob",
  homeWorld: "WorldB",
  retainers: [],
};

const renderApp = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
    { wrapper: withQueryClient() },
  );

const navLink = (name: string) => screen.getByRole("link", { name });

const pickCharacter = async (id: string) =>
  fireEvent.change(await screen.findByLabelText("Selling as"), {
    target: { value: id },
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadConfig).mockResolvedValue({
    trackedItems: [],
    regions: [],
    marketBoardCities: [],
    params: {} as TradingParameters,
  });
  mockedGetCharacters.mockResolvedValue([alice, bob]);
  mockedGetCurrentCharacterId.mockResolvedValue(null);
  mockedSetCurrentCharacterId.mockResolvedValue();
});

afterEach(cleanup);

describe("App", () => {
  describe("the Current Character", () => {
    it("should start out on the first character in the roster when none has been picked before", async () => {
      renderApp();

      await screen.findByText("Tracked items selling as Alice");
    });

    it("should start out on the character picked on an earlier visit", async () => {
      mockedGetCurrentCharacterId.mockResolvedValue("bob");

      renderApp();

      await screen.findByText("Tracked items selling as Bob");
    });

    it("should fall back to the first character when the one picked earlier is no longer in the roster", async () => {
      mockedGetCurrentCharacterId.mockResolvedValue("retired");

      renderApp();

      await screen.findByText("Tracked items selling as Alice");
    });

    it("should start out on the first character when the one picked earlier can't be read", async () => {
      mockedGetCurrentCharacterId.mockRejectedValue(new Error("blocked"));

      renderApp();

      await screen.findByText("Tracked items selling as Alice");
    });

    it("should remember a newly picked character for later visits", async () => {
      renderApp();

      await pickCharacter("bob");

      await screen.findByText("Tracked items selling as Bob");
      expect(mockedSetCurrentCharacterId).toHaveBeenCalledWith("bob");
    });

    it("should keep a newly picked character when moving to another page", async () => {
      renderApp();

      await pickCharacter("bob");
      fireEvent.click(navLink("High Volume Items"));

      await screen.findByText("High volume items for Bob");
    });

    it("should show the Current Character's home world alongside it", async () => {
      renderApp();

      await pickCharacter("bob");

      await screen.findByText("WorldB");
    });
  });

  describe("the character roster", () => {
    it.each(["/", "/high-volume-items", "/item/5"])(
      "should welcome someone with no characters on %s, and point them to adding one",
      async (path) => {
        mockedGetCharacters.mockResolvedValue([]);

        renderApp(path);

        await screen.findByRole("heading", { name: "Welcome!" });
        expect(
          screen.queryByText(/Tracked items|High volume|Item profit/),
        ).toBe(null);
        fireEvent.click(
          screen.getByRole("link", { name: "Add your first character" }),
        );
        await screen.findByRole("button", { name: "Change the roster" });
      },
    );

    it("should show the page once a first character has been added", async () => {
      mockedGetCharacters.mockResolvedValue([]);
      renderApp();
      fireEvent.click(
        await screen.findByRole("link", { name: "Add your first character" }),
      );
      mockedGetCharacters.mockResolvedValue([alice]);

      fireEvent.click(
        await screen.findByRole("button", { name: "Change the roster" }),
      );
      await screen.findByText("WorldA");
      fireEvent.click(navLink("Tracked Items"));

      await screen.findByText("Tracked items selling as Alice");
    });

    it("should offer to add a character from the navbar when there are none", async () => {
      mockedGetCharacters.mockResolvedValue([]);

      renderApp();

      fireEvent.click(
        await screen.findByRole("link", { name: "Add a character" }),
      );
      await screen.findByRole("button", { name: "Change the roster" });
    });

    it("should read the roster again after it's changed, so the change shows everywhere", async () => {
      const carol: Character = {
        id: "carol",
        name: "Carol",
        homeWorld: "WorldC",
        retainers: [],
      };
      renderApp("/characters");
      const changeButton = await screen.findByRole("button", {
        name: "Change the roster",
      });
      mockedGetCharacters.mockResolvedValue([alice, bob, carol]);

      fireEvent.click(changeButton);

      await screen.findByRole("option", { name: "Carol" });
    });

    it("should move to another character when the Current Character is removed", async () => {
      renderApp("/characters");
      await pickCharacter("bob");
      mockedGetCharacters.mockResolvedValue([alice]);

      fireEvent.click(
        screen.getByRole("button", { name: "Change the roster" }),
      );
      await screen.findByText("WorldA");
      fireEvent.click(navLink("Tracked Items"));

      await screen.findByText("Tracked items selling as Alice");
    });
  });

  describe("the navbar", () => {
    it("should move between pages", async () => {
      renderApp();
      await screen.findByText("Tracked items selling as Alice");

      fireEvent.click(navLink("High Volume Items"));
      await screen.findByText("High volume items for Alice");

      fireEvent.click(navLink("Characters"));
      await screen.findByRole("button", { name: "Change the roster" });

      fireEvent.click(navLink("Tracked Items"));
      await screen.findByText("Tracked items selling as Alice");
    });

    it("should mark only the page being viewed as current", async () => {
      renderApp("/high-volume-items");
      await screen.findByText("High volume items for Alice");

      expect(navLink("High Volume Items").getAttribute("aria-current")).toBe(
        "page",
      );
      expect(navLink("Tracked Items").hasAttribute("aria-current")).toBe(false);
      expect(navLink("Characters").hasAttribute("aria-current")).toBe(false);
    });

    it("should mark no page as current on a page it doesn't link to", async () => {
      renderApp("/item/5");
      await screen.findByText("Item profit scan");

      expect(navLink("High Volume Items").hasAttribute("aria-current")).toBe(
        false,
      );
      expect(navLink("Tracked Items").hasAttribute("aria-current")).toBe(false);
      expect(navLink("Characters").hasAttribute("aria-current")).toBe(false);
    });
  });
});
