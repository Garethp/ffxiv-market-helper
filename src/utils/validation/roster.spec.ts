import { describe, expect, it } from "vitest";
import type { Character, RegionInfo, Retainer } from "../../types";
import {
  validateCharacter,
  validateRetainer,
  tidyCharacterDetails,
  tidyRetainerDetails,
  type ReferenceData,
} from "./roster";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
  },
];

const reference: ReferenceData = {
  regions,
  marketBoardCities: ["Ul'dah", "Kugane"],
};

const alice: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "Raiden",
  retainers: [],
};

const bella: Retainer = { id: "bella", name: "Bella", city: "Ul'dah" };

describe("tidying details", () => {
  it("should trim a character's name and note, treating a blank note as no note", () => {
    expect(
      tidyCharacterDetails({
        name: "  Alice  ",
        homeWorld: "Raiden",
        note: "   ",
      }),
    ).toEqual({ name: "Alice", homeWorld: "Raiden", note: undefined });
  });

  it("should trim a retainer's name", () => {
    expect(tidyRetainerDetails({ name: "  Bella ", city: "Ul'dah" })).toEqual({
      name: "Bella",
      city: "Ul'dah",
    });
  });
});

describe("validateCharacter", () => {
  describe("a character nothing is wrong with", () => {
    it("should give no reason at all", () => {
      expect(
        validateCharacter(
          { name: "Zoe", homeWorld: "Odin" },
          [alice],
          reference,
        ),
      ).toBeUndefined();
    });

    it("should give no reason for the same name on a different world", () => {
      expect(
        validateCharacter(
          { name: "Alice", homeWorld: "Odin" },
          [alice],
          reference,
        ),
      ).toBeUndefined();
    });
  });

  describe("the name", () => {
    it.each(["", "   "])(
      "should give a reason for %o, which is no name at all",
      (name) => {
        expect(
          validateCharacter({ name, homeWorld: "Raiden" }, [], reference),
        ).toEqual({ reason: "missing-name" });
      },
    );
  });

  describe("the home world", () => {
    it("should name a world that isn't in the region directory", () => {
      expect(
        validateCharacter({ name: "Zoe", homeWorld: "Nowhere" }, [], reference),
      ).toEqual({ reason: "unknown-world", world: "Nowhere" });
    });
  });

  describe("a name and world another character already has", () => {
    it("should name the character and world it clashes with", () => {
      expect(
        validateCharacter(
          { name: "Alice", homeWorld: "Raiden" },
          [alice],
          reference,
        ),
      ).toEqual({
        reason: "duplicate-character",
        name: "Alice",
        world: "Raiden",
      });
    });

    it("should still say so when the name is only the same once trimmed", () => {
      expect(
        validateCharacter(
          { name: "  Alice  ", homeWorld: "Raiden" },
          [alice],
          reference,
        ),
      ).toMatchObject({ reason: "duplicate-character" });
    });

    it("should let the character the details belong to keep its own name and world", () => {
      expect(
        validateCharacter(
          { name: "Alice", homeWorld: "Raiden" },
          [alice],
          reference,
          { excludingId: "alice" },
        ),
      ).toBeUndefined();
    });
  });
});

describe("validateRetainer", () => {
  describe("a retainer nothing is wrong with", () => {
    it("should give no reason at all", () => {
      expect(
        validateRetainer({ name: "Cleo", city: "Kugane" }, [bella], reference),
      ).toBeUndefined();
    });
  });

  describe("the name", () => {
    it.each(["", "   "])(
      "should give a reason for %o, which is no name at all",
      (name) => {
        expect(
          validateRetainer({ name, city: "Ul'dah" }, [], reference),
        ).toEqual({
          reason: "missing-name",
        });
      },
    );
  });

  describe("the city", () => {
    it("should name a city that has no market board", () => {
      expect(
        validateRetainer({ name: "Cleo", city: "Nowhere" }, [], reference),
      ).toEqual({ reason: "unknown-city", city: "Nowhere" });
    });
  });

  describe("a name another of the character's retainers already has", () => {
    it("should name the retainer it clashes with", () => {
      expect(
        validateRetainer({ name: "Bella", city: "Kugane" }, [bella], reference),
      ).toEqual({ reason: "duplicate-retainer", name: "Bella" });
    });

    it("should let the retainer the details belong to keep its own name", () => {
      expect(
        validateRetainer(
          { name: "Bella", city: "Kugane" },
          [bella],
          reference,
          {
            excludingId: "bella",
          },
        ),
      ).toBeUndefined();
    });
  });
});
