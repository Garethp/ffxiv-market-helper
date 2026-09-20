// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemSearchResult } from "../types";

vi.mock("../services/itemService", () => ({
  itemService: { searchItems: vi.fn(), getItemSummaries: vi.fn() },
}));

import { itemService } from "../services/itemService";
import { withQueryClient } from "../testing/withQueryClient";
import { ItemSearch } from "./ItemSearch";

const mockedSearchItems = vi.mocked(itemService.searchItems);
const mockedGetItemSummaries = vi.mocked(itemService.getItemSummaries);

const cordial: ItemSearchResult = {
  itemId: 6141,
  name: "Cordial",
  stackSize: 999,
};
const wateredCordial: ItemSearchResult = {
  itemId: 16911,
  name: "Watered Cordial",
  stackSize: 999,
};

/** A promise whose resolution is controlled from outside. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const renderSearch = (onPick = vi.fn()) => {
  render(<ItemSearch onPick={onPick} />, { wrapper: withQueryClient() });
  return onPick;
};

/** Types the text one character at a time, as someone would. */
const typeText = (text: string) => {
  const input = screen.getByLabelText("Search for an item");
  for (let length = 1; length <= text.length; length++) {
    fireEvent.change(input, { target: { value: text.slice(0, length) } });
  }
};

const waitLongerThanTypingPause = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 500)));

beforeEach(() => {
  mockedSearchItems.mockResolvedValue([cordial, wateredCordial]);
  mockedGetItemSummaries.mockResolvedValue(
    new Map([
      [
        6141,
        { type: "Medicine", description: "A sweet, fermented concoction." },
      ],
    ]),
  );
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("ItemSearch", () => {
  it("should search once typing stops, listing the matching items", async () => {
    renderSearch();

    typeText("cordial");

    await screen.findByRole("button", { name: "Cordial" });
    expect(
      screen.getByRole("button", { name: "Watered Cordial" }),
    ).toBeTruthy();
    expect(mockedSearchItems).toHaveBeenCalledTimes(1);
    expect(mockedSearchItems).toHaveBeenCalledWith("cordial", {
      signal: expect.any(AbortSignal),
    });
  });

  it("should not search until at least 2 characters are typed", async () => {
    renderSearch();

    typeText("c");
    await waitLongerThanTypingPause();

    expect(mockedSearchItems).not.toHaveBeenCalled();
  });

  it("should not count surrounding whitespace towards the 2 characters", async () => {
    renderSearch();

    typeText("  c  ");
    await waitLongerThanTypingPause();

    expect(mockedSearchItems).not.toHaveBeenCalled();
  });

  it("should show that it's searching", async () => {
    mockedSearchItems.mockReturnValue(deferred<ItemSearchResult[]>().promise);
    renderSearch();

    typeText("cordial");

    await screen.findByText("Searching…");
  });

  it("should say when no items match", async () => {
    mockedSearchItems.mockResolvedValue([]);
    renderSearch();

    typeText("zzz");

    await screen.findByText('No items found for "zzz".');
  });

  it("should say when the search couldn't be done", async () => {
    mockedSearchItems.mockRejectedValue(new Error("XIVAPI item search failed"));
    renderSearch();

    typeText("cordial");

    await screen.findByText("Couldn't search for items. Try again shortly.");
  });

  it("should only show results for the latest text, even when an earlier search finishes last", async () => {
    const earlier = deferred<ItemSearchResult[]>();
    mockedSearchItems
      .mockReturnValueOnce(earlier.promise)
      .mockResolvedValueOnce([wateredCordial]);
    renderSearch();
    typeText("cordial");
    await waitFor(() => expect(mockedSearchItems).toHaveBeenCalledTimes(1));

    typeText("watered cordial");
    await screen.findByRole("button", { name: "Watered Cordial" });
    await act(async () => earlier.resolve([cordial]));

    expect(screen.queryByRole("button", { name: "Cordial" })).toBeNull();
  });

  it("should show what an item is when its result is hovered", async () => {
    renderSearch();
    typeText("cordial");
    const result = await screen.findByRole("button", { name: "Cordial" });

    fireEvent.mouseEnter(result);

    await screen.findByText("A sweet, fermented concoction.");
    expect(screen.getByText("Medicine")).not.toBeNull();
    expect(
      document.getElementById(result.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toContain("A sweet, fermented concoction.");
  });

  it("should pass on the item that's picked", async () => {
    const onPick = renderSearch();
    typeText("cordial");

    fireEvent.click(await screen.findByRole("button", { name: "Cordial" }));

    expect(onPick).toHaveBeenCalledWith(cordial);
  });
});
