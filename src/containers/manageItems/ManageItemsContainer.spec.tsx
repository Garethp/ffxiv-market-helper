// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemSearchResult, TradingParameters } from "../../types";

vi.mock("../../hooks/useIsNarrowScreen", () => ({
  useIsNarrowScreen: vi.fn(),
}));
// Nothing here opens a row far enough to need a real summary.
vi.mock("../../services/itemService", () => ({
  itemService: { getItemSummaries: vi.fn().mockResolvedValue(new Map()) },
}));
// The real localStorage implementation, starting out with nothing tracked.
vi.mock("../../services/trackedItemService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/trackedItemService")>();
  return {
    ...actual,
    trackedItemService: new actual.LocalStorageTrackedItemService([]),
  };
});

import { useIsNarrowScreen } from "../../hooks/useIsNarrowScreen";
import { useReloadable } from "../../hooks/useReloadable";
import { trackedItemService } from "../../services/trackedItemService";
import { buildTradingConfig } from "../../services/tradingConfig";
import { createQueryClientWrapper } from "../../testing/createQueryClientWrapper";
import { ManageItemsContainer } from "./ManageItemsContainer";

const loadedConfig = {
  regions: [],
  marketBoardCities: [],
  params: {} as TradingParameters,
};

const cordial: ItemSearchResult = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
};

const loadTrackedItems = () => trackedItemService.getTrackedItems();

/** Reads the tracked items again whenever the page reports a change, the way the app does. */
const ManageItemsPage = () => {
  const [trackedItems, reload] = useReloadable(loadTrackedItems);
  return trackedItems ? (
    <ManageItemsContainer
      config={buildTradingConfig(loadedConfig, [], trackedItems)}
      onTrackedItemsChanged={reload}
    />
  ) : null;
};

const renderPage = async () => {
  render(
    <MemoryRouter>
      <ManageItemsPage />
    </MemoryRouter>,
    { wrapper: createQueryClientWrapper() },
  );
  await screen.findByRole("heading", { name: "Manage Items" });
};

const mockedIsNarrowScreen = vi.mocked(useIsNarrowScreen);

describe("ManageItemsContainer", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedIsNarrowScreen.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("with nothing tracked", () => {
    it("should say so instead of listing anything", async () => {
      await renderPage();

      await screen.findByText(/No items are tracked yet/);
      expect(screen.queryByRole("list", { name: "Tracked items" })).toBeNull();
    });
  });

  describe("a tracked item", () => {
    beforeEach(async () => {
      await trackedItemService.trackItem({
        ...cordial,
        targetQuantity: 999,
        sellPriceCeiling: 5000,
      });
    });

    it("should lead to the page for changing its settings", async () => {
      await renderPage();
      const [item] = await trackedItemService.getTrackedItems();

      const link = screen.getByRole("link", { name: "Edit Cordial (NQ)" });

      expect(link.getAttribute("href")).toBe(`/manage-items/edit/${item.id}`);
    });

    it("should stop tracking the item", async () => {
      await renderPage();

      fireEvent.click(
        screen.getByRole("button", { name: "Stop tracking Cordial (NQ)" }),
      );

      await screen.findByText(/No items are tracked yet/);
      expect(await trackedItemService.getTrackedItems()).toEqual([]);
    });

    it("should say something went wrong when it couldn't be untracked at all", async () => {
      vi.spyOn(trackedItemService, "untrackItem").mockRejectedValue(
        new Error("storage is full"),
      );
      await renderPage();

      fireEvent.click(
        screen.getByRole("button", { name: "Stop tracking Cordial (NQ)" }),
      );

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Something went wrong. Try again shortly.",
      );
      expect(screen.getByText("Cordial")).toBeTruthy();
    });
  });

  describe("on a narrow screen", () => {
    beforeEach(async () => {
      mockedIsNarrowScreen.mockReturnValue(true);
      await trackedItemService.trackItem({ ...cordial, targetQuantity: 999 });
    });

    it("should show each item as a row that opens up, holding the ways to change it", async () => {
      await renderPage();

      expect(
        screen.queryByRole("link", { name: "Edit Cordial (NQ)" }),
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Show what Cordial (NQ) is" }),
      );
      expect(
        screen.getByRole("link", { name: "Edit Cordial (NQ)" }),
      ).toBeTruthy();
    });

    it("should stop tracking an item from its opened row", async () => {
      await renderPage();

      fireEvent.click(
        screen.getByRole("button", { name: "Show what Cordial (NQ) is" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Stop tracking Cordial (NQ)" }),
      );

      await screen.findByText(/No items are tracked yet/);
      expect(await trackedItemService.getTrackedItems()).toEqual([]);
    });
  });

  describe("tracking a new item", () => {
    it("should lead to the page for it", async () => {
      await renderPage();

      const link = screen.getByRole("link", { name: "Track a new item" });

      expect(link.getAttribute("href")).toBe("/manage-items/track");
    });
  });
});
