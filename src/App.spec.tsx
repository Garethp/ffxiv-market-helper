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

const renderApp = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const navLink = (name: string) => screen.getByRole("link", { name });

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
      fireEvent.click(navLink("High Volume Items"));

      await screen.findByText("High volume items for Bob");
    });

    it("should show the Current Character's home world alongside it", async () => {
      renderApp();

      fireEvent.change(await screen.findByLabelText("Selling as"), {
        target: { value: "Bob" },
      });

      await screen.findByText("WorldB");
    });
  });

  describe("the navbar", () => {
    it("should move between pages", async () => {
      renderApp();
      await screen.findByText("Tracked items selling as Alice");

      fireEvent.click(navLink("High Volume Items"));
      await screen.findByText("High volume items for Alice");

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
    });

    it("should mark no page as current on a page it doesn't link to", async () => {
      renderApp("/item/5");
      await screen.findByText("Item profit scan");

      expect(navLink("High Volume Items").hasAttribute("aria-current")).toBe(
        false,
      );
      expect(navLink("Tracked Items").hasAttribute("aria-current")).toBe(false);
    });
  });
});
