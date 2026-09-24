// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TradingConfig } from "./services/tradingConfig";
import type { Character, TrackedItem, TradingParameters } from "./types";

type PageProps = {
  config: TradingConfig;
  currentCharacter?: Character;
};

vi.mock("./services/tradingConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/tradingConfig")>()),
  loadConfig: vi.fn(),
}));
vi.mock("./services/characterService", () => ({
  characterService: { getCharacters: vi.fn() },
}));
vi.mock("./services/trackedItemService", () => ({
  trackedItemService: { getTrackedItems: vi.fn() },
}));
vi.mock("./services/currentCharacterService", () => ({
  currentCharacterService: {
    getCurrentCharacterId: vi.fn(),
    setCurrentCharacterId: vi.fn(),
  },
}));
vi.mock("./hooks/useItemDataStatus", () => ({
  useItemDataStatus: vi.fn(),
}));
// Stand-ins that show which page is open and which character it was given.
vi.mock("./containers/TrackedItemsContainer", () => ({
  TrackedItemsContainer: ({ config, currentCharacter }: PageProps) => (
    <>
      <p>Tracked items selling as {currentCharacter?.name}</p>
      <ul>
        {config.trackedItems.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </>
  ),
}));
vi.mock("./containers/HighVolumeItemsContainer", () => ({
  HighVolumeItemsContainer: ({ currentCharacter }: PageProps) => (
    <p>High volume items for {currentCharacter?.name}</p>
  ),
}));
vi.mock("./containers/ExpertDeliveryContainer", () => ({
  ExpertDeliveryContainer: () => <p>Expert delivery items</p>,
}));
vi.mock("./containers/manageItems/ManageItemsContainer", () => ({
  ManageItemsContainer: ({
    onTrackedItemsChanged,
  }: {
    onTrackedItemsChanged: () => void;
  }) => (
    <button type="button" onClick={onTrackedItemsChanged}>
      Change the tracked items
    </button>
  ),
}));
vi.mock("./containers/manageItems/TrackNewItemContainer", () => ({
  TrackNewItemContainer: ({
    onTrackedItemsChanged,
  }: {
    onTrackedItemsChanged: () => void;
  }) => (
    <button type="button" onClick={onTrackedItemsChanged}>
      Track a new item
    </button>
  ),
}));
vi.mock("./containers/manageItems/EditTrackedItemContainer", () => ({
  EditTrackedItemContainer: ({
    onTrackedItemsChanged,
  }: {
    onTrackedItemsChanged: () => void;
  }) => (
    <button type="button" onClick={onTrackedItemsChanged}>
      Change this item
    </button>
  ),
}));
vi.mock("./containers/characters/CharactersContainer", () => ({
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
// Each page for changing the roster names itself on a button that reports a change.
const { createRosterChangingPage } = vi.hoisted(() => ({
  createRosterChangingPage:
    (name: string) =>
    ({ onCharactersChanged }: { onCharactersChanged: () => void }) => (
      <button type="button" onClick={onCharactersChanged}>
        {name}
      </button>
    ),
}));
vi.mock("./containers/characters/AddCharacterContainer", () => ({
  AddCharacterContainer: createRosterChangingPage("Add a character"),
}));
vi.mock("./containers/characters/EditCharacterContainer", () => ({
  EditCharacterContainer: createRosterChangingPage("Change this character"),
}));
vi.mock("./containers/characters/AddRetainerContainer", () => ({
  AddRetainerContainer: createRosterChangingPage("Add a retainer"),
}));
vi.mock("./containers/characters/EditRetainerContainer", () => ({
  EditRetainerContainer: createRosterChangingPage("Change this retainer"),
}));

import App from "./App";
import { useItemDataStatus } from "./hooks/useItemDataStatus";
import { createQueryClientWrapper } from "./testing/createQueryClientWrapper";
import { characterService } from "./services/characterService";
import { currentCharacterService } from "./services/currentCharacterService";
import { loadConfig } from "./services/tradingConfig";
import { trackedItemService } from "./services/trackedItemService";

const mockedGetCharacters = vi.mocked(characterService.getCharacters);
const mockedGetTrackedItems = vi.mocked(trackedItemService.getTrackedItems);
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

const cordial: TrackedItem = {
  id: "cordial",
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
  targetQuantity: 999,
};

const renderApp = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
    { wrapper: createQueryClientWrapper() },
  );

const getNavLink = (name: string) => screen.getByRole("link", { name });

const pickCharacter = async (id: string) =>
  fireEvent.change(await screen.findByLabelText("Selling as"), {
    target: { value: id },
  });

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useItemDataStatus).mockReturnValue({ state: "ready" });
    vi.mocked(loadConfig).mockResolvedValue({
      regions: [],
      marketBoardCities: [],
      params: {} as TradingParameters,
    });
    mockedGetCharacters.mockResolvedValue([alice, bob]);
    mockedGetTrackedItems.mockResolvedValue([]);
    mockedGetCurrentCharacterId.mockResolvedValue(undefined);
    mockedSetCurrentCharacterId.mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
  });

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
      fireEvent.click(getNavLink("High Volume Items"));

      await screen.findByText("High volume items for Bob");
    });
  });

  describe("the character roster", () => {
    it.each(["/"])(
      "should welcome someone with no characters on %s, and point them to adding one",
      async (path) => {
        mockedGetCharacters.mockResolvedValue([]);

        renderApp(path);

        await screen.findByRole("heading", { name: "Welcome!" });
        expect(
          screen.queryByText(/Tracked items|High volume|Expert delivery/),
        ).toBe(null);
        fireEvent.click(
          screen.getByRole("link", { name: "Add your first character" }),
        );
        await screen.findByRole("button", { name: "Change the roster" });
      },
    );

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

    it.each([
      ["/characters/new", "Add a character"],
      ["/characters/alice/edit", "Change this character"],
      ["/characters/alice/retainers/new", "Add a retainer"],
      ["/characters/alice/retainers/amarana/edit", "Change this retainer"],
    ])(
      "should read the roster again after it's changed on %s",
      async (path, changeButtonName) => {
        const carol: Character = {
          id: "carol",
          name: "Carol",
          homeWorld: "WorldC",
          retainers: [],
        };
        renderApp(path);
        const changeButton = await screen.findByRole("button", {
          name: changeButtonName,
        });
        mockedGetCharacters.mockResolvedValue([alice, bob, carol]);

        fireEvent.click(changeButton);

        await screen.findByRole("option", { name: "Carol" });
      },
    );

    it("should move to another character when the Current Character is removed", async () => {
      renderApp("/characters");
      await pickCharacter("bob");
      mockedGetCharacters.mockResolvedValue([alice]);

      fireEvent.click(
        screen.getByRole("button", { name: "Change the roster" }),
      );
      await screen.findByText("WorldA");
      fireEvent.click(getNavLink("Tracked Items"));

      await screen.findByText("Tracked items selling as Alice");
    });
  });

  describe("tracked items", () => {
    it("should read the tracked items again after they're changed, so the change shows everywhere", async () => {
      renderApp("/manage-items");
      const changeButton = await screen.findByRole("button", {
        name: "Change the tracked items",
      });
      mockedGetTrackedItems.mockResolvedValue([cordial]);

      fireEvent.click(changeButton);
      fireEvent.click(getNavLink("Tracked Items"));

      await screen.findByText("Cordial");
    });

    it("should let items be managed before any character has been added", async () => {
      mockedGetCharacters.mockResolvedValue([]);

      renderApp("/manage-items");

      await screen.findByRole("button", { name: "Change the tracked items" });
    });

    it("should read the tracked items again after one is changed on its own page", async () => {
      renderApp("/manage-items/edit/cordial");
      const changeButton = await screen.findByRole("button", {
        name: "Change this item",
      });
      mockedGetTrackedItems.mockResolvedValue([cordial]);

      fireEvent.click(changeButton);
      fireEvent.click(getNavLink("Tracked Items"));

      await screen.findByText("Cordial");
    });

    it("should read the tracked items again after a new one is tracked on its own page", async () => {
      renderApp("/manage-items/track");
      const trackButton = await screen.findByRole("button", {
        name: "Track a new item",
      });
      mockedGetTrackedItems.mockResolvedValue([cordial]);

      fireEvent.click(trackButton);
      fireEvent.click(getNavLink("Tracked Items"));

      await screen.findByText("Cordial");
    });
  });

  describe("loading item data", () => {
    it("should show how it's going on every page", async () => {
      vi.mocked(useItemDataStatus).mockReturnValue({
        state: "loading",
        itemsSoFar: 500,
      });
      renderApp();
      await screen.findByText("Tracked items selling as Alice");
      expect(screen.getByText(/Loading item data: 500 items/)).not.toBeNull();

      fireEvent.click(getNavLink("Characters"));
      await screen.findByRole("button", { name: "Change the roster" });

      expect(screen.getByText(/Loading item data: 500 items/)).not.toBeNull();
    });
  });

  describe("the navbar", () => {
    it("should move between pages", async () => {
      renderApp();
      await screen.findByText("Tracked items selling as Alice");

      fireEvent.click(getNavLink("High Volume Items"));
      await screen.findByText("High volume items for Alice");

      fireEvent.click(getNavLink("Expert Delivery"));
      await screen.findByText("Expert delivery items");

      fireEvent.click(getNavLink("Characters"));
      await screen.findByRole("button", { name: "Change the roster" });

      fireEvent.click(getNavLink("Manage Items"));
      await screen.findByRole("button", { name: "Change the tracked items" });

      fireEvent.click(getNavLink("Tracked Items"));
      await screen.findByText("Tracked items selling as Alice");
    });
  });
});
