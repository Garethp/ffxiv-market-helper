import { describe, expect, it, vi } from "vitest";
import { InMemoryLockManager } from "./InMemoryLockManager";
import { holdLock, tryHoldLock } from "./webLocks";

describe("tryHoldLock", () => {
  it("should give nothing, without waiting, for a lock held by something else", async () => {
    const locks = new InMemoryLockManager();
    await holdLock(locks, "lock", { mode: "exclusive" });

    expect(await tryHoldLock(locks, "lock", "exclusive")).toBeUndefined();
  });

  it("should hold the lock until released", async () => {
    const locks = new InMemoryLockManager();
    const release = await tryHoldLock(locks, "lock", "exclusive");

    expect(await tryHoldLock(locks, "lock", "exclusive")).toBeUndefined();
    release!();
    // Released once the holder's callback settles, which isn't immediate.
    await vi.waitFor(async () =>
      expect(await tryHoldLock(locks, "lock", "exclusive")).toBeTypeOf(
        "function",
      ),
    );
  });
});
