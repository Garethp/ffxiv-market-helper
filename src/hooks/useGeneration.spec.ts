// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGeneration } from "./useGeneration";

describe("useGeneration", () => {
  it("should consider a run current once it starts", () => {
    const { result } = renderHook(() => useGeneration());
    const first = result.current.start();

    expect(result.current.isCurrent(first)).toBe(true);
  });

  it("should stop considering an old run current once a newer one starts", () => {
    const { result } = renderHook(() => useGeneration());
    const first = result.current.start();
    const second = result.current.start();

    expect(result.current.isCurrent(first)).toBe(false);
    expect(result.current.isCurrent(second)).toBe(true);
  });
});
