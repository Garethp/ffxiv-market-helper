// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemSearchResult } from "../api/xivapi";
import type { TradingParameters } from "../types";

vi.mock("../api/xivapi", () => ({ searchItems: vi.fn() }));
// The real localStorage implementation, starting out with nothing tracked.
vi.mock("../services/trackedItemService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/trackedItemService")>();
  return {
    ...actual,
    trackedItemService: new actual.LocalStorageTrackedItemService([]),
  };
});

import { searchItems } from "../api/xivapi";
import { useReloadable } from "../hooks/useReloadable";
import { trackedItemService } from "../services/trackedItemService";
import { buildTradingConfig } from "../services/tradingConfig";
import { withQueryClient } from "../testing/withQueryClient";
import { ManageItemsContainer } from "./ManageItemsContainer";

const mockedSearchItems = vi.mocked(searchItems);

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
  render(<ManageItemsPage />, { wrapper: withQueryClient() });
  await screen.findByRole("heading", { name: "Manage Items" });
};

/** Searches for Cordial and picks it, opening the form to track it. */
const pickCordial = async () => {
  fireEvent.change(screen.getByLabelText("Search for an item"), {
    target: { value: "cordial" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Cordial" }));
  return screen.findByRole("form", { name: "Track Cordial" });
};

const setField = (container: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(container).getByLabelText(label), {
    target: { value },
  });

const trackedItemsList = () =>
  screen.findByRole("list", { name: "Tracked items" });

beforeEach(() => {
  localStorage.clear();
  mockedSearchItems.mockResolvedValue([cordial]);
});

afterEach(() => {
  cleanup();
  mockedSearchItems.mockReset();
});

describe("ManageItemsContainer", () => {
  it("should say when no items are tracked yet", async () => {
    await renderPage();

    expect(screen.getByText(/No items are tracked yet/)).toBeTruthy();
  });

  describe("tracking an item", () => {
    it("should track a found item with the chosen quality, target quantity and sell price ceiling", async () => {
      await renderPage();
      const form = await pickCordial();

      fireEvent.click(within(form).getByLabelText("HQ"));
      setField(form, "Target quantity", "500");
      setField(form, "Sell price ceiling", "5000");
      fireEvent.click(within(form).getByRole("button", { name: "Track item" }));

      within(await trackedItemsList()).getByText("Cordial");
      expect(await trackedItemService.getTrackedItems()).toEqual([
        {
          id: expect.any(String),
          itemId: 6141,
          name: "Cordial",
          stackSize: 999,
          hq: true,
          targetQuantity: 500,
          sellPriceCeiling: 5000,
        },
      ]);
    });

    it("should start the target quantity at the item's stack size", async () => {
      await renderPage();

      const form = await pickCordial();

      expect(
        (within(form).getByLabelText("Target quantity") as HTMLInputElement)
          .value,
      ).toBe("999");
    });

    it("should only track the item once NQ or HQ has been chosen", async () => {
      await renderPage();
      const form = await pickCordial();
      const trackButton = within(form).getByRole("button", {
        name: "Track item",
      }) as HTMLButtonElement;

      expect(trackButton.disabled).toBe(true);
      fireEvent.click(within(form).getByLabelText("NQ"));
      expect(trackButton.disabled).toBe(false);
    });

    it("should close the form once the item is tracked", async () => {
      await renderPage();
      const form = await pickCordial();

      fireEvent.click(within(form).getByLabelText("NQ"));
      fireEvent.click(within(form).getByRole("button", { name: "Track item" }));

      within(await trackedItemsList()).getByText("Cordial");
      expect(screen.queryByRole("form", { name: "Track Cordial" })).toBeNull();
    });

    it("should explain why an item couldn't be tracked", async () => {
      await trackedItemService.trackItem({ ...cordial, targetQuantity: 999 });
      await renderPage();
      const form = await pickCordial();

      fireEvent.click(within(form).getByLabelText("NQ"));
      fireEvent.click(within(form).getByRole("button", { name: "Track item" }));

      expect((await within(form).findByRole("alert")).textContent).toBe(
        "Cordial is already tracked as NQ.",
      );
    });

    it("should start the form over when a different item is picked", async () => {
      const materia: ItemSearchResult = {
        itemId: 41771,
        name: "Heavens' Eye Materia XII",
        stackSize: 999,
      };
      mockedSearchItems.mockResolvedValue([cordial, materia]);
      await renderPage();
      const cordialForm = await pickCordial();
      fireEvent.click(within(cordialForm).getByLabelText("HQ"));
      setField(cordialForm, "Target quantity", "5");

      fireEvent.click(screen.getByRole("button", { name: materia.name }));

      const materiaForm = await screen.findByRole("form", {
        name: `Track ${materia.name}`,
      });
      expect(
        (within(materiaForm).getByLabelText("HQ") as HTMLInputElement).checked,
      ).toBe(false);
      expect(
        (
          within(materiaForm).getByLabelText(
            "Target quantity",
          ) as HTMLInputElement
        ).value,
      ).toBe("999");
      expect(screen.queryByRole("form", { name: "Track Cordial" })).toBeNull();
    });

    it("should not track the item when cancelled", async () => {
      await renderPage();
      const form = await pickCordial();

      fireEvent.click(within(form).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("form", { name: "Track Cordial" })).toBeNull();
      expect(await trackedItemService.getTrackedItems()).toEqual([]);
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

    it("should show each tracked item's quality, target quantity and sell price ceiling", async () => {
      await renderPage();

      const item = within(await trackedItemsList()).getByRole("listitem");
      expect(item.textContent).toContain("Cordial");
      expect(item.textContent).toContain("NQ");
      expect(item.textContent).toContain("Target quantity 999");
      expect(item.textContent).toContain("Sell price ceiling 5k");
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

    it("should keep the form open, explaining why, when the change can't be saved", async () => {
      await renderPage();

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );
      const form = screen.getByRole("form", { name: "Edit Cordial (NQ)" });
      setField(form, "Target quantity", "");
      fireEvent.click(within(form).getByRole("button", { name: "Save" }));

      expect((await within(form).findByRole("alert")).textContent).toBe(
        "Target quantity needs to be a whole number of at least 1.",
      );
    });

    it("should leave the item as it was when editing is cancelled", async () => {
      await renderPage();

      fireEvent.click(
        screen.getByRole("button", { name: "Edit Cordial (NQ)" }),
      );
      const form = screen.getByRole("form", { name: "Edit Cordial (NQ)" });
      setField(form, "Target quantity", "60");
      fireEvent.click(within(form).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("form")).toBeNull();
      const [unchanged] = await trackedItemService.getTrackedItems();
      expect(unchanged.targetQuantity).toBe(999);
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
});
