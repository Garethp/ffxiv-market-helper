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
import type { PricedItem, TradingParameters } from "../../types";

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
import { EditTrackedItemContainer } from "./EditTrackedItemContainer";

const loadedConfig = {
  regions: [],
  marketBoardCities: [],
  params: {} as TradingParameters,
};

const cordial: PricedItem = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
  targetQuantity: 999,
};

const onTrackedItemsChanged = vi.fn();

/** Reads the tracked items the way the app does, so the page can find the one being changed. */
const EditTrackedItemPage = () => {
  const [trackedItems, reload] = useReloadable(() =>
    trackedItemService.getTrackedItems(),
  );
  return trackedItems ? (
    <EditTrackedItemContainer
      config={buildTradingConfig(loadedConfig, [], trackedItems)}
      onTrackedItemsChanged={() => {
        onTrackedItemsChanged();
        reload();
      }}
    />
  ) : null;
};

/** Tracks the item and returns its ID, so there's something to change. */
const track = async (item: PricedItem = cordial) => {
  await trackedItemService.trackItem(item);
  const trackedItems = await trackedItemService.getTrackedItems();
  return trackedItems[trackedItems.length - 1].id;
};

/** The page for one item, alongside a stand-in for the list it goes back to. */
const renderPage = (itemId: string) =>
  render(
    <MemoryRouter initialEntries={[`/manage-items/edit/${itemId}`]}>
      <Routes>
        <Route path="/manage-items" element={<p>Tracked items page</p>} />
        <Route
          path="/manage-items/edit/:itemId"
          element={<EditTrackedItemPage />}
        />
      </Routes>
    </MemoryRouter>,
    { wrapper: withQueryClient() },
  );

/** The page's form, once the item it's for has been read. */
const editForm = () => screen.findByRole("form");

const fieldValue = (form: HTMLElement, label: string) =>
  (within(form).getByLabelText(label) as HTMLInputElement).value;

const setField = (form: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });

const backOnTheList = () => screen.findByText("Tracked items page");

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  onTrackedItemsChanged.mockReset();
  vi.restoreAllMocks();
});

describe("EditTrackedItemContainer", () => {
  it("should name the item and start with the settings it's tracked with", async () => {
    const id = await track({ ...cordial, hq: true, sellPriceCeiling: 5000 });

    renderPage(id);
    const form = await editForm();

    screen.getByRole("heading", { name: "Edit Cordial (HQ)" });
    expect(
      (within(form).getByLabelText("HQ") as HTMLInputElement).checked,
    ).toBe(true);
    expect(fieldValue(form, "Target quantity")).toBe("999");
    expect(fieldValue(form, "Sell price ceiling")).toBe("5k");
  });

  it("should save the entered settings and go back to the list, reporting the change", async () => {
    const id = await track({ ...cordial, sellPriceCeiling: 5000 });
    renderPage(id);
    const form = await editForm();

    fireEvent.click(within(form).getByLabelText("HQ"));
    setField(form, "Target quantity", "60");
    setField(form, "Sell price ceiling", "");
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    await backOnTheList();
    const [changed] = await trackedItemService.getTrackedItems();
    expect(changed).toMatchObject({ hq: true, targetQuantity: 60 });
    expect(changed.sellPriceCeiling).toBeUndefined();
    expect(onTrackedItemsChanged).toHaveBeenCalled();
  });

  it("should stay put explaining settings the tracked items wouldn't take, saving nothing", async () => {
    const id = await track();
    await track({ ...cordial, hq: true });
    renderPage(id);
    const form = await editForm();

    fireEvent.click(within(form).getByLabelText("HQ"));
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Cordial is already tracked as HQ.",
    );
    expect(screen.queryByText("Tracked items page")).toBeNull();
    const [unchanged] = await trackedItemService.getTrackedItems();
    expect(unchanged.hq).toBeUndefined();
    expect(onTrackedItemsChanged).not.toHaveBeenCalled();
  });

  it("should stay put saying something went wrong when saving fails outright", async () => {
    const id = await track();
    vi.spyOn(trackedItemService, "updateTrackedItem").mockRejectedValue(
      new Error("storage is full"),
    );
    renderPage(id);
    const form = await editForm();

    setField(form, "Target quantity", "60");
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Something went wrong. Try again shortly.",
    );
    expect(screen.queryByText("Tracked items page")).toBeNull();
  });

  it.each(["Cancel", "Back to tracked items"])(
    "should go back to the list changing nothing when %s is used",
    async (control) => {
      const id = await track();
      renderPage(id);
      const form = await editForm();
      setField(form, "Target quantity", "60");

      fireEvent.click(screen.getByText(control));

      await backOnTheList();
      expect(await trackedItemService.getTrackedItems()).toEqual([
        { id, ...cordial },
      ]);
      expect(onTrackedItemsChanged).not.toHaveBeenCalled();
    },
  );

  it("should go straight back to the list when the item isn't tracked", async () => {
    renderPage("never-tracked");

    await backOnTheList();
    expect(screen.queryByRole("form")).toBeNull();
  });
});
