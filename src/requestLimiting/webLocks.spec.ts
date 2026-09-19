import { describe, expect, it, vi } from "vitest";
import { InMemoryLockManager } from "./InMemoryLockManager";
import { holdLock, tryHoldLock } from "./webLocks";

describe("tryHoldLock", () => {
  it("should take a lock nothing else holds", async () => {
    const locks = new InMemoryLockManager();

    const release = await tryHoldLock(locks, "lock", "exclusive");

    expect(release).toBeTypeOf("function");
  });

  it("should give nothing, without waiting, for a lock held by something else", async () => {
    const locks = new InMemoryLockManager();
    await holdLock(locks, "lock", { mode: "exclusive" });

    expect(await tryHoldLock(locks, "lock", "exclusive")).toBeNull();
  });

  it("should give nothing for a lock that's free but has another request waiting for it", async () => {
    const locks = new InMemoryLockManager();
    const releaseShared = await holdLock(locks, "lock", { mode: "shared" });
    const waiting = holdLock(locks, "lock", { mode: "exclusive" });

    expect(await tryHoldLock(locks, "lock", "shared")).toBeNull();

    releaseShared();
    await waiting;
  });

  it("should take a shared lock alongside another shared holder", async () => {
    const locks = new InMemoryLockManager();
    await holdLock(locks, "lock", { mode: "shared" });

    expect(await tryHoldLock(locks, "lock", "shared")).toBeTypeOf("function");
  });

  it("should hold the lock until released", async () => {
    const locks = new InMemoryLockManager();
    const release = await tryHoldLock(locks, "lock", "exclusive");

    expect(await tryHoldLock(locks, "lock", "exclusive")).toBeNull();
    release!();
    // Released once the holder's callback settles, which isn't immediate.
    await vi.waitFor(async () =>
      expect(await tryHoldLock(locks, "lock", "exclusive")).toBeTypeOf(
        "function",
      ),
    );
  });
});
