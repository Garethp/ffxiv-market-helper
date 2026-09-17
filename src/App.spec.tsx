// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Character, TradingParameters } from "./types";

type PageProps = { currentCharacter: Character | null };

vi.mock("./services/tradingConfig", () => ({ loadTradingConfig: vi.fn() }));
vi.mock("./services/currentCharacterService", () => ({
  currentCharacterService: {
    getCurrentCharacterName: vi.fn(),
    setCurrentCharacterName: vi.fn(),
  },
}));
// Stand-ins that show which character each page was given, and let a test navigate between them.
vi.mock("./containers/TrackedItemsContainer", async () => {
  const { Link } = await import("react-router-dom");
  return {
    TrackedItemsContainer: ({ currentCharacter }: PageProps) => (
      <>
        <p>Tracked items selling as {currentCharacter?.name}</p>
        <Link to="/high-volume-items">High volume items</Link>
      </>
    ),
  };
});
vi.mock("./containers/HighVolumeItemsContainer", () => ({
  HighVolumeItemsContainer: ({ currentCharacter }: PageProps) => (
    <p>High volume items for {currentCharacter?.name}</p>
  ),
}));
vi.mock("./containers/ItemProfitScanContainer", () => ({
  ItemProfitScanContainer: () => null,
}));

import App from "./App";
import { currentCharacterService } from "./services/currentCharacterService";
import { loadTradingConfig } from "./services/tradingConfig";

const mockedGetCurrentCharacterName = vi.mocked(
  currentCharacterService.getCurrentCharacterName,
);
const mockedSetCurrentCharacterName = vi.mocked(
  currentCharacterService.setCurrentCharacterName,
);

const alice: Character = { name: "Alice", homeWorld: "WorldA", retainers: [] };
const bob: Character = { name: "Bob", homeWorld: "WorldB", retainers: [] };

const renderApp = () =>
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadTradingConfig).mockResolvedValue({
    trackedItems: [],
    characters: [alice, bob],
    regions: [],
    params: {} as TradingParameters,
    defaultCharacterName: "Alice",
    buyingRegions: [],
    ownRetainers: [],
  });
  mockedGetCurrentCharacterName.mockResolvedValue(null);
  mockedSetCurrentCharacterName.mockResolvedValue();
});

afterEach(cleanup);

describe("App", () => {
  describe("the Current Character", () => {
    it("should start out on the Default Character when none has been picked before", async () => {
      renderApp();

      await screen.findByText("Tracked items selling as Alice");
    });

    it("should start out on the character picked on an earlier visit", async () => {
      mockedGetCurrentCharacterName.mockResolvedValue("Bob");

      renderApp();

      await screen.findByText("Tracked items selling as Bob");
    });

    it("should fall back to the Default Character when the one picked earlier is no longer in the roster", async () => {
      mockedGetCurrentCharacterName.mockResolvedValue("Retired Character");

      renderApp();

      await screen.findByText("Tracked items selling as Alice");
    });

    it("should start out on the Default Character when the one picked earlier can't be read", async () => {
      mockedGetCurrentCharacterName.mockRejectedValue(new Error("blocked"));

      renderApp();

      await screen.findByText("Tracked items selling as Alice");
    });

    it("should remember a newly picked character for later visits", async () => {
      renderApp();

      fireEvent.change(await screen.findByLabelText("Selling as"), {
        target: { value: "Bob" },
      });

      await screen.findByText("Tracked items selling as Bob");
      expect(mockedSetCurrentCharacterName).toHaveBeenCalledWith("Bob");
    });

    it("should keep a newly picked character when moving to another page", async () => {
      renderApp();

      fireEvent.change(await screen.findByLabelText("Selling as"), {
        target: { value: "Bob" },
      });
      fireEvent.click(screen.getByText("High volume items"));

      await screen.findByText("High volume items for Bob");
    });
  });
});
