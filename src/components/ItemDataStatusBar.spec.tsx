// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ItemDataStatus } from "../services/itemDataCache";
import { ItemDataStatusBar } from "./ItemDataStatusBar";

const renderBar = (status: ItemDataStatus) =>
  render(<ItemDataStatusBar status={status} />);

afterEach(cleanup);

describe("ItemDataStatusBar", () => {
  it.each([{ state: "idle" } as const])(
    "should show nothing while $state",
    (status) => {
      const { container } = renderBar(status);

      expect(container.innerHTML).toBe("");
    },
  );

  it("should say how many items have loaded so far, and why it's loading them", () => {
    renderBar({ state: "loading", itemsSoFar: 1500 });

    expect(screen.getByRole("status").textContent).toBe(
      "Loading item data: 1,500 items so far. This only happens once per game update, and makes item names quick to look up from then on.",
    );
  });

  it("should say it's waiting on another tab", () => {
    renderBar({ state: "waiting" });

    expect(screen.getByRole("status").textContent).toBe(
      "Waiting for another tab to finish loading item data…",
    );
  });

  it("should say why loading failed, and what happens instead", () => {
    renderBar({ state: "failed", message: "XIVAPI is down" });

    expect(screen.getByRole("status").textContent).toBe(
      "Couldn't load item data (XIVAPI is down). Item names will be looked up as they're needed instead.",
    );
  });
});
