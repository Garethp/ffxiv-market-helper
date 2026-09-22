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
import type { ItemSearchResult, TradingParameters } from "../../types";

vi.mock("../../services/itemService", () => ({
  itemService: { searchItems: vi.fn() },
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

import { useReloadable } from "../../hooks/useReloadable";
import { itemService } from "../../services/itemService";
import { trackedItemService } from "../../services/trackedItemService";
import { buildTradingConfig } from "../../services/tradingConfig";
import { withQueryClient } from "../../testing/withQueryClient";
import { TrackNewItemContainer } from "./TrackNewItemContainer";

const mockedSearchItems = vi.mocked(itemService.searchItems);

const cordial: ItemSearchResult = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
};

const loadedConfig = {
  regions: [],
  marketBoardCities: [],
  params: {} as TradingParameters,
};

const onTrackedItemsChanged = vi.fn();

/** Reads the tracked items the way the app does, so the page can check them. */
const TrackNewItemPage = () => {
  const [trackedItems, reload] = useReloadable(() =>
    trackedItemService.getTrackedItems(),
  );
  return trackedItems ? (
    <TrackNewItemContainer
      config={buildTradingConfig(loadedConfig, [], trackedItems)}
      onTrackedItemsChanged={() => {
        onTrackedItemsChanged();
        reload();
      }}
    />
  ) : null;
};

/** The page, alongside a stand-in for the tracked items it goes back to. */
const renderPage = async () => {
  render(
    <MemoryRouter initialEntries={["/manage-items/track"]}>
      <Routes>
        <Route path="/manage-items" element={<p>Tracked items page</p>} />
        <Route path="/manage-items/track" element={<TrackNewItemPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: withQueryClient() },
  );
  await screen.findByRole("heading", { name: "Track a New Item" });
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

beforeEach(() => {
  localStorage.clear();
  mockedSearchItems.mockResolvedValue([cordial]);
});

afterEach(() => {
  cleanup();
  mockedSearchItems.mockReset();
  onTrackedItemsChanged.mockReset();
});

describe("TrackNewItemContainer", () => {
  it("should track a found item with the chosen quality, target quantity and sell price ceiling", async () => {
    await renderPage();
    const form = await pickCordial();

    fireEvent.click(within(form).getByLabelText("HQ"));
    setField(form, "Target quantity", "500");
    setField(form, "Sell price ceiling", "5000");
    fireEvent.click(within(form).getByRole("button", { name: "Track item" }));

    await screen.findByText("Tracked items page");
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

    await screen.findByText("Tracked items page");
    expect(onTrackedItemsChanged).toHaveBeenCalled();
  });

  it("should start the target quantity at three market board stacks of the item", async () => {
    await renderPage();

    const form = await pickCordial();

    expect(
      (within(form).getByLabelText("Target quantity") as HTMLInputElement)
        .value,
    ).toBe("297");
  });

  it("should stay on the page when the item is already tracked", async () => {
    await trackedItemService.trackItem({ ...cordial, targetQuantity: 999 });
    await renderPage();
    const form = await pickCordial();

    fireEvent.click(within(form).getByLabelText("NQ"));
    fireEvent.click(within(form).getByRole("button", { name: "Track item" }));

    await within(form).findByText(/already tracked/i);
    expect(screen.queryByText("Tracked items page")).toBeNull();
    expect(onTrackedItemsChanged).not.toHaveBeenCalled();
  });

  it("should stop clear a previous error message once a new item is picked", async () => {
    const materia: ItemSearchResult = {
      itemId: 41771,
      name: "Heavens' Eye Materia XII",
      stackSize: 999,
    };
    mockedSearchItems.mockResolvedValue([cordial, materia]);

    await trackedItemService.trackItem({ ...cordial, targetQuantity: 999 });
    await renderPage();

    const form = await pickCordial();
    fireEvent.click(within(form).getByLabelText("NQ"));
    fireEvent.click(within(form).getByRole("button", { name: "Track item" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: materia.name }));

    await screen.findByRole("form", { name: `Track ${materia.name}` });
    expect(screen.queryByRole("alert")).toBeNull();
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
    ).toBe("297");
    expect(screen.queryByRole("form", { name: "Track Cordial" })).toBeNull();
  });

  it("should offer a way back to the tracked items without tracking anything", async () => {
    await renderPage();

    fireEvent.click(
      screen.getByRole("link", { name: "Back to tracked items" }),
    );

    await screen.findByText("Tracked items page");
    expect(await trackedItemService.getTrackedItems()).toEqual([]);
  });
});
