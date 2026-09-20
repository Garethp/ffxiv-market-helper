// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/itemService", () => ({
  itemService: { getItemSummaries: vi.fn() },
}));

import { itemService } from "../services/itemService";
import { descriptionOf } from "../testing/descriptionOf";
import { withQueryClient } from "../testing/withQueryClient";
import { ItemSummaryTooltip } from "./ItemSummaryTooltip";

const mockedGetItemSummaries = vi.mocked(itemService.getItemSummaries);

const summaryIs = (type: string | undefined, description: string) =>
  mockedGetItemSummaries.mockResolvedValue(
    new Map([[2212, { type, description }]]),
  );

const renderTooltip = (props: { note?: string } = {}) =>
  render(
    <ItemSummaryTooltip itemId={2212} name="Deus Ex Gratia" {...props} />,
    {
      wrapper: withQueryClient(),
    },
  );

const icon = () => screen.queryByRole<HTMLImageElement>("presentation");

const hoverName = () =>
  fireEvent.mouseEnter(screen.getByText("Deus Ex Gratia"));

beforeEach(() => {
  summaryIs("Scholar's Arm", "A grimoire of the scholarly arts.");
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("ItemSummaryTooltip", () => {
  it("should show the item's icon, type and what the game says about it once hovered", async () => {
    renderTooltip();

    hoverName();

    expect(icon()!.src).toBe(
      "https://universalis-ffxiv.github.io/universalis-assets/icon2x/2212.png",
    );
    await screen.findByText("A grimoire of the scholarly arts.");
    expect(screen.getByText("Scholar's Arm")).not.toBeNull();
  });

  it("should show them once focused, so it can be read without a pointer", async () => {
    renderTooltip();

    fireEvent.focus(screen.getByText("Deus Ex Gratia"));

    await screen.findByText("A grimoire of the scholarly arts.");
  });

  it("should look nothing up, and fetch no icon, until it's opened", () => {
    renderTooltip();

    expect(icon()).toBeNull();
    expect(mockedGetItemSummaries).not.toHaveBeenCalled();
  });

  it("should describe the name by what's shown, so it's announced as its description", async () => {
    renderTooltip();

    hoverName();

    await screen.findByText("A grimoire of the scholarly arts.");
    expect(descriptionOf(screen.getByText("Deus Ex Gratia"))).toContain(
      "A grimoire of the scholarly arts.",
    );
  });

  it("should leave out the type for an item that has none", async () => {
    summaryIs(undefined, "A grimoire of the scholarly arts.");
    renderTooltip();

    hoverName();

    await screen.findByText("A grimoire of the scholarly arts.");
    expect(screen.queryByText("Scholar's Arm")).toBeNull();
  });

  it("should leave out the description for an item the game says nothing about", async () => {
    summaryIs("Scholar's Arm", "");
    renderTooltip();

    hoverName();

    await screen.findByText("Scholar's Arm");
    expect(screen.getByRole("tooltip").textContent).toBe("Scholar's Arm");
  });

  it("should still show the icon when nothing is known about the item", async () => {
    mockedGetItemSummaries.mockResolvedValue(new Map());
    renderTooltip();

    hoverName();

    expect(icon()).not.toBeNull();
    expect(screen.getByRole("tooltip").textContent).toBe("");
  });

  it("should leave out an icon that can't be loaded", () => {
    renderTooltip();
    hoverName();

    fireEvent.error(icon()!);

    expect(icon()).toBeNull();
  });

  it("should show a note about the name alongside what the item is", async () => {
    renderTooltip({ note: "Opens in a new tab" });

    hoverName();

    await screen.findByText("Opens in a new tab");
  });

  it("should wrap whatever the name is built as, pointing it at what's shown", async () => {
    render(
      <ItemSummaryTooltip itemId={2212}>
        {(tooltipId) => (
          <a href="/item/2212" aria-describedby={tooltipId}>
            Deus Ex Gratia
          </a>
        )}
      </ItemSummaryTooltip>,
      { wrapper: withQueryClient() },
    );

    fireEvent.mouseEnter(screen.getByRole("link"));

    await screen.findByText("A grimoire of the scholarly arts.");
    expect(descriptionOf(screen.getByRole("link"))).toContain(
      "A grimoire of the scholarly arts.",
    );
  });
});
