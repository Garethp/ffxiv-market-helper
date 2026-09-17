// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { currentCharacterService } from "./currentCharacterService";

beforeEach(() => {
  localStorage.clear();
});

describe("currentCharacterService", () => {
  it("should have no Current Character before one has been picked", async () => {
    expect(await currentCharacterService.getCurrentCharacterName()).toBeNull();
  });

  it("should remember the most recently picked Current Character", async () => {
    await currentCharacterService.setCurrentCharacterName("Alice");
    await currentCharacterService.setCurrentCharacterName("Bob");

    expect(await currentCharacterService.getCurrentCharacterName()).toBe("Bob");
  });
});
