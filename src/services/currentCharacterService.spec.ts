// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { currentCharacterService } from "./currentCharacterService";

beforeEach(() => {
  localStorage.clear();
});

describe("currentCharacterService", () => {
  it("should remember the most recently picked Current Character", async () => {
    await currentCharacterService.setCurrentCharacterId("alice-id");
    await currentCharacterService.setCurrentCharacterId("bob-id");

    expect(await currentCharacterService.getCurrentCharacterId()).toBe(
      "bob-id",
    );
  });
});
