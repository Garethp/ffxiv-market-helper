// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ItemDataStatus } from "../services/itemDataCache";

let status: ItemDataStatus = { state: "checking" };
const listeners = new Set<() => void>();

vi.mock("../services/itemService", () => ({
  itemService: {
    getItemDataStatus: () => status,
    subscribeToItemDataStatus: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
}));

import { useItemDataStatus } from "./useItemDataStatus";

const changeStatus = (newStatus: ItemDataStatus) =>
  act(() => {
    status = newStatus;
    listeners.forEach((listener) => listener());
  });

describe("useItemDataStatus", () => {
  it("should give the item data's status, and keep it current as it changes", () => {
    const { result, unmount } = renderHook(() => useItemDataStatus());
    expect(result.current).toEqual({ state: "checking" });

    changeStatus({ state: "loading", itemsSoFar: 500 });

    expect(result.current).toEqual({ state: "loading", itemsSoFar: 500 });
    unmount();
    expect(listeners.size).toBe(0);
  });
});
