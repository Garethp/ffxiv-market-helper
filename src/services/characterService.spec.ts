// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { Character, RegionInfo } from "../types";
import {
  LocalStorageCharacterService,
  type CharacterDetails,
  type CharacterService,
  type NewCharacter,
} from "./characterService";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
  },
];

const config = {
  getRegions: async () => regions,
  getMarketBoardCities: async () => ["Ul'dah", "Kugane"],
};

const createService = (initialCharacters: NewCharacter[] = []) =>
  new LocalStorageCharacterService(initialCharacters, config);

const alice: CharacterDetails = { name: "Alice", homeWorld: "Raiden" };

/** Adds a character and returns it as saved. */
const addCharacter = async (
  service: CharacterService,
  details = alice,
): Promise<Character> => {
  expect(await service.addCharacter(details)).toEqual({ ok: true });
  const roster = await service.getCharacters();
  return roster[roster.length - 1];
};

beforeEach(() => {
  localStorage.clear();
});

describe("characterService", () => {
  describe("starting out", () => {
    it("should start out with the initial characters, each character and retainer given an ID", async () => {
      const service = createService([
        {
          ...alice,
          note: "Main",
          retainers: [{ name: "Amarana", city: "Ul'dah" }],
        },
      ]);

      expect(await service.getCharacters()).toEqual([
        {
          id: expect.any(String),
          ...alice,
          note: "Main",
          retainers: [
            { id: expect.any(String), name: "Amarana", city: "Ul'dah" },
          ],
        },
      ]);
    });
  });

  describe("adding a character", () => {
    it("should add the character with no retainers", async () => {
      const service = createService();

      await service.addCharacter({ ...alice, note: "Main" });

      expect(await service.getCharacters()).toEqual([
        { id: expect.any(String), ...alice, note: "Main", retainers: [] },
      ]);
    });

    it("should ignore surrounding whitespace, and treat a blank note as no note", async () => {
      const service = createService();

      await service.addCharacter({
        name: "  Alice ",
        homeWorld: "Raiden",
        note: "   ",
      });

      const [character] = await service.getCharacters();
      expect(character.name).toBe("Alice");
      expect(character.note).toBeUndefined();
    });

    it("should refuse a character with no name", async () => {
      const service = createService();

      expect(
        await service.addCharacter({ name: " ", homeWorld: "Raiden" }),
      ).toEqual({ ok: false, error: { reason: "missing-name" } });
      expect(await service.getCharacters()).toEqual([]);
    });

    it("should refuse a home world that isn't in the region directory", async () => {
      const service = createService();

      expect(
        await service.addCharacter({ name: "Alice", homeWorld: "Nowhere" }),
      ).toEqual({
        ok: false,
        error: { reason: "unknown-world", world: "Nowhere" },
      });
      expect(await service.getCharacters()).toEqual([]);
    });

    it("should refuse a second character with the same name on the same world", async () => {
      const service = createService();
      await addCharacter(service);

      expect(await service.addCharacter(alice)).toEqual({
        ok: false,
        error: {
          reason: "duplicate-character",
          name: "Alice",
          world: "Raiden",
        },
      });
      expect(await service.getCharacters()).toHaveLength(1);
    });

    it("should allow characters with the same name on different worlds", async () => {
      const service = createService();
      await addCharacter(service);

      expect(
        await service.addCharacter({ name: "Alice", homeWorld: "Odin" }),
      ).toEqual({ ok: true });
    });
  });

  describe("changing a character", () => {
    it("should replace the character's details, keeping its ID and retainers", async () => {
      const service = createService();
      const character = await addCharacter(service);
      await service.addRetainer(character.id, {
        name: "Amarana",
        city: "Ul'dah",
      });
      const [withRetainer] = await service.getCharacters();

      await service.updateCharacter(character.id, {
        name: "Alicia",
        homeWorld: "Odin",
        note: "Transferred",
      });

      expect(await service.getCharacters()).toEqual([
        {
          ...withRetainer,
          name: "Alicia",
          homeWorld: "Odin",
          note: "Transferred",
        },
      ]);
    });

    it("should remove the note when it's left blank", async () => {
      const service = createService();
      const character = await addCharacter(service, {
        ...alice,
        note: "Main",
      });

      await service.updateCharacter(character.id, { ...alice, note: "" });

      const [changed] = await service.getCharacters();
      expect(changed.note).toBeUndefined();
    });

    it("should allow a character to keep its own name and world", async () => {
      const service = createService();
      const character = await addCharacter(service);

      expect(
        await service.updateCharacter(character.id, { ...alice, note: "Hi" }),
      ).toEqual({ ok: true });
    });

    it("should refuse a name and world another character already has", async () => {
      const service = createService();
      await addCharacter(service, alice);
      const bob = await addCharacter(service, { ...alice, name: "Bob" });

      expect(await service.updateCharacter(bob.id, alice)).toEqual({
        ok: false,
        error: {
          reason: "duplicate-character",
          name: "Alice",
          world: "Raiden",
        },
      });
      expect((await service.getCharacters())[1].name).toBe("Bob");
    });

    it("should refuse to change a character that isn't in the roster", async () => {
      expect(await createService().updateCharacter("missing", alice)).toEqual({
        ok: false,
        error: { reason: "character-not-found" },
      });
    });
  });

  describe("removing a character", () => {
    it("should remove only that character", async () => {
      const service = createService();
      const first = await addCharacter(service, alice);
      const second = await addCharacter(service, { ...alice, name: "Bob" });

      await service.removeCharacter(first.id);

      expect(await service.getCharacters()).toEqual([second]);
    });

    it("should refuse to remove a character that isn't in the roster", async () => {
      expect(await createService().removeCharacter("missing")).toEqual({
        ok: false,
        error: { reason: "character-not-found" },
      });
    });
  });

  describe("adding a retainer", () => {
    it("should add the retainer to that character", async () => {
      const service = createService();
      const character = await addCharacter(service);

      await service.addRetainer(character.id, {
        name: " Amarana ",
        city: "Ul'dah",
      });

      const [changed] = await service.getCharacters();
      expect(changed.retainers).toEqual([
        { id: expect.any(String), name: "Amarana", city: "Ul'dah" },
      ]);
    });

    it("should refuse a retainer with no name", async () => {
      const service = createService();
      const character = await addCharacter(service);

      expect(
        await service.addRetainer(character.id, { name: "", city: "Ul'dah" }),
      ).toEqual({ ok: false, error: { reason: "missing-name" } });
    });

    it("should refuse a city that isn't a market board city", async () => {
      const service = createService();
      const character = await addCharacter(service);

      expect(
        await service.addRetainer(character.id, {
          name: "Amarana",
          city: "Nowhere",
        }),
      ).toEqual({
        ok: false,
        error: { reason: "unknown-city", city: "Nowhere" },
      });
    });

    it("should refuse a second retainer with the same name on the same character", async () => {
      const service = createService();
      const character = await addCharacter(service);
      const retainer = { name: "Amarana", city: "Ul'dah" };
      await service.addRetainer(character.id, retainer);

      expect(await service.addRetainer(character.id, retainer)).toEqual({
        ok: false,
        error: { reason: "duplicate-retainer", name: "Amarana" },
      });
    });

    it("should allow retainers with the same name on different characters", async () => {
      const service = createService();
      const first = await addCharacter(service, alice);
      const second = await addCharacter(service, { ...alice, name: "Bob" });
      const retainer = { name: "Amarana", city: "Ul'dah" };
      await service.addRetainer(first.id, retainer);

      expect(await service.addRetainer(second.id, retainer)).toEqual({
        ok: true,
      });
    });

    it("should refuse to add a retainer to a character that isn't in the roster", async () => {
      expect(
        await createService().addRetainer("missing", {
          name: "Amarana",
          city: "Ul'dah",
        }),
      ).toEqual({ ok: false, error: { reason: "character-not-found" } });
    });
  });

  describe("changing a retainer", () => {
    const addCharacterWithRetainers = async (
      service: CharacterService,
      ...names: string[]
    ) => {
      const character = await addCharacter(service);
      for (const name of names) {
        await service.addRetainer(character.id, { name, city: "Ul'dah" });
      }
      const [saved] = await service.getCharacters();
      return saved;
    };

    it("should replace the retainer's details, keeping its ID", async () => {
      const service = createService();
      const character = await addCharacterWithRetainers(service, "Amarana");
      const [retainer] = character.retainers;

      await service.updateRetainer(character.id, retainer.id, {
        name: "Belliana",
        city: "Kugane",
      });

      const [changed] = await service.getCharacters();
      expect(changed.retainers).toEqual([
        { id: retainer.id, name: "Belliana", city: "Kugane" },
      ]);
    });

    it("should allow a retainer to keep its own name", async () => {
      const service = createService();
      const character = await addCharacterWithRetainers(service, "Amarana");
      const [retainer] = character.retainers;

      expect(
        await service.updateRetainer(character.id, retainer.id, {
          name: "Amarana",
          city: "Kugane",
        }),
      ).toEqual({ ok: true });
    });

    it("should refuse a name another of the character's retainers already has", async () => {
      const service = createService();
      const character = await addCharacterWithRetainers(
        service,
        "Amarana",
        "Belliana",
      );
      const [, second] = character.retainers;

      expect(
        await service.updateRetainer(character.id, second.id, {
          name: "Amarana",
          city: "Ul'dah",
        }),
      ).toEqual({
        ok: false,
        error: { reason: "duplicate-retainer", name: "Amarana" },
      });
    });

    it("should refuse to change a retainer the character doesn't have", async () => {
      const service = createService();
      const character = await addCharacter(service);

      expect(
        await service.updateRetainer(character.id, "missing", {
          name: "Amarana",
          city: "Ul'dah",
        }),
      ).toEqual({ ok: false, error: { reason: "retainer-not-found" } });
    });
  });

  describe("removing a retainer", () => {
    it("should remove only that retainer", async () => {
      const service = createService();
      const character = await addCharacter(service);
      await service.addRetainer(character.id, {
        name: "Amarana",
        city: "Ul'dah",
      });
      await service.addRetainer(character.id, {
        name: "Belliana",
        city: "Ul'dah",
      });
      const [first, second] = (await service.getCharacters())[0].retainers;

      await service.removeRetainer(character.id, first.id);

      expect((await service.getCharacters())[0].retainers).toEqual([second]);
    });

    it("should refuse to remove a retainer the character doesn't have", async () => {
      const service = createService();
      const character = await addCharacter(service);

      expect(await service.removeRetainer(character.id, "missing")).toEqual({
        ok: false,
        error: { reason: "retainer-not-found" },
      });
    });
  });
});
