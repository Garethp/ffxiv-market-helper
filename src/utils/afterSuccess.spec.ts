import { describe, expect, it, vi } from "vitest";
import { afterSuccess } from "./afterSuccess";

describe("afterSuccess", () => {
  it("should carry on once the change has been made, passing its result on", async () => {
    const then = vi.fn();

    expect(await afterSuccess(Promise.resolve({ ok: true }), then)).toEqual({
      ok: true,
    });
    expect(then).toHaveBeenCalledTimes(1);
  });

  it("should not carry on when the change is refused, passing its result on", async () => {
    const then = vi.fn();
    const refused = { ok: false, error: "nope" };

    expect(await afterSuccess(Promise.resolve(refused), then)).toBe(refused);
    expect(then).not.toHaveBeenCalled();
  });
});
