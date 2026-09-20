// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReloadable } from "./useReloadable";

describe("useReloadable", () => {
  it("should read again when reloaded, and give what was read", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const { result } = renderHook(() => useReloadable(load));
    await waitFor(() => expect(result.current[0]).toBe("first"));

    act(() => result.current[1]());

    await waitFor(() => expect(result.current[0]).toBe("second"));
  });

  it("should not read again just because it's rendered again", async () => {
    const load = vi.fn(async () => "first");
    const { result, rerender } = renderHook(() => useReloadable(load));
    await waitFor(() => expect(result.current[0]).toBe("first"));

    rerender();

    expect(load).toHaveBeenCalledTimes(1);
  });
});
