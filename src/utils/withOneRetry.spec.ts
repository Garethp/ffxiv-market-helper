import { describe, expect, it, vi } from "vitest";
import { withOneRetry } from "./withOneRetry";

describe("withOneRetry", () => {
  it("should return the result on the first try when it succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    await expect(withOneRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry once and return the result when the retry succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce("ok");

    await expect(withOneRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should give up after the retry also fails, surfacing the retry's error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockRejectedValueOnce(new Error("retry failure"));

    await expect(withOneRetry(fn)).rejects.toThrow("retry failure");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should not retry once the signal has been aborted", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error("cancelled");
    });

    await expect(withOneRetry(fn, controller.signal)).rejects.toThrow(
      "cancelled",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
