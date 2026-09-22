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
import type { ItemSearchResult, TradingParameters } from "../../types";

// The real localStorage implementation, starting out with nothing tracked.
vi.mock("../../services/trackedItemService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/trackedItemService")>();
  return {
    ...actual,
    trackedItemService: new actual.LocalStorageTrackedItemService([]),
  };
});

import { useReloadable } from "../../hooks/useReloadable";
import { trackedItemService } from "../../services/trackedItemService";
import { buildTradingConfig } from "../../services/tradingConfig";
import { withQueryClient } from "../../testing/withQueryClient";
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
    { wrapper: withQueryClient() },
  );
  await screen.findByRole("heading", { name: "Manage Items" });
};

const setField = (container: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(container).getByLabelText(label), {
    target: { value },
  });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ManageItemsContainer", () => {
  describe("with nothing tracked", () => {
    it("should say so instead of listing anything", async () => {
      await renderPage();

      await screen.findByText(/No items are tracked yet/);
      expect(screen.queryByRole("list", { name: "Tracked items" })).toBeNull();
    });
  });

  describe("changing a tracked item", () => {
    beforeEach(async () => {
      await trackedItemService.trackItem({
        ...cordial,
        targetQuantity: 999,
        sellPriceCeiling: 5000,
      });
    });

    it("should save the changed settings", async () => {
      await renderPage();

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );
      const form = screen.getByRole("form", { name: "Edit Cordial (NQ)" });
      fireEvent.click(within(form).getByLabelText("HQ"));
      setField(form, "Target quantity", "60");
      setField(form, "Sell price ceiling", "");
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));

      await screen.findByRole("button", { name: "Edit Cordial (HQ)" });
      const [changed] = await trackedItemService.getTrackedItems();
      expect(changed).toMatchObject({ hq: true, targetQuantity: 60 });
      expect(changed.sellPriceCeiling).toBeUndefined();
    });

    it("should explain a quality the item is already tracked with, leaving it as it was", async () => {
      await trackedItemService.trackItem({
        ...cordial,
        hq: true,
        targetQuantity: 999,
      });
      await renderPage();

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );
      const form = screen.getByRole("form", { name: "Edit Cordial (NQ)" });
      fireEvent.click(within(form).getByLabelText("HQ"));
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Cordial is already tracked as HQ.",
      );
      const [unchanged] = await trackedItemService.getTrackedItems();
      expect(unchanged.hq).toBeUndefined();
    });

    it("should say something went wrong when the change couldn't be made at all", async () => {
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

    it("should stop explaining a refusal once editing is given up on", async () => {
      await trackedItemService.trackItem({
        ...cordial,
        hq: true,
        targetQuantity: 999,
      });
      await renderPage();
      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );
      const form = screen.getByRole("form", { name: "Edit Cordial (NQ)" });
      fireEvent.click(within(form).getByLabelText("HQ"));
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));
      await screen.findByRole("alert");

      fireEvent.click(within(form).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should stop tracking the item", async () => {
      await renderPage();

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
