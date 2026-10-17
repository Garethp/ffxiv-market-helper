import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedCallback } from "./useDebouncedCallback";

const advanceTime = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call back once calls pause, with the last call's arguments", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    result.current("a", 1);
    advanceTime(100);
    result.current("b", 2);
    advanceTime(299);

    expect(callback).not.toHaveBeenCalled();
    advanceTime(1);
    expect(callback).toHaveBeenCalledExactlyOnceWith("b", 2);
  });

  it("should restart the wait on a call repeating the last one's arguments", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    result.current(0);
    advanceTime(200);
    result.current(0);
    advanceTime(299);

    expect(callback).not.toHaveBeenCalled();
    advanceTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("should call the latest callback it was given", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ callback }) => useDebouncedCallback(callback, 300),
      { initialProps: { callback: first } },
    );

    result.current();
    rerender({ callback: second });
    advanceTime(300);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("should keep the same function while the delay stays the same", () => {
    const { result, rerender } = renderHook(
      ({ callback }) => useDebouncedCallback(callback, 300),
      { initialProps: { callback: vi.fn() } },
    );
    const debounced = result.current;

    rerender({ callback: vi.fn() });

    expect(result.current).toBe(debounced);
  });

  it("should not call back once the component has gone", () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(callback, 300),
    );

    result.current();
    unmount();
    advanceTime(300);

    expect(callback).not.toHaveBeenCalled();
  });
});
