import { describe, expect, it } from "vitest";
import type { Character, RegionInfo, Retainer } from "../../types";
import {
  validateCharacter,
  validateRetainer,
  tidyCharacterDetails,
  tidyRetainerDetails,
} from "./roster";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
  },
];

const marketBoardCities = ["Ul'dah", "Kugane"];

const alice: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "Raiden",
  retainers: [],
};

const bella: Retainer = { id: "bella", name: "Bella", city: "Ul'dah" };

describe("roster validation", () => {
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
      expect(tidyRetainerDetails({ name: "  Bella ", city: "Ul'dah" })).toEqual(
        {
          name: "Bella",
          city: "Ul'dah",
        },
      );
    });
  });

  describe("validateCharacter", () => {
    describe("a character nothing is wrong with", () => {
      it("should give no reason at all", () => {
        expect(
          validateCharacter(
            { name: "Zoe", homeWorld: "Odin" },
            [alice],
            regions,
          ),
        ).toBeUndefined();
      });

      it("should give no reason for the same name on a different world", () => {
        expect(
          validateCharacter(
            { name: "Alice", homeWorld: "Odin" },
            [alice],
            regions,
          ),
        ).toBeUndefined();
      });
    });

    describe("the name", () => {
      it.each(["", "   "])(
        "should give a reason for %o, which is no name at all",
        (name) => {
          expect(
            validateCharacter({ name, homeWorld: "Raiden" }, [], regions),
          ).toBe("A name is needed.");
        },
      );
    });

    describe("the home world", () => {
      it("should name a world that isn't in the region directory", () => {
        expect(
          validateCharacter({ name: "Zoe", homeWorld: "Nowhere" }, [], regions),
        ).toBe("Nowhere isn't a known world.");
      });

      it("should still read sensibly when no world was given", () => {
        expect(
          validateCharacter({ name: "Zoe", homeWorld: "" }, [], regions),
        ).toBe("That isn't a known world.");
      });
    });

    describe("a name and world another character already has", () => {
      it("should name the character and world it clashes with", () => {
        expect(
          validateCharacter(
            { name: "Alice", homeWorld: "Raiden" },
            [alice],
            regions,
          ),
        ).toBe("There's already a character named Alice on Raiden.");
      });

      it("should still say so when the name is only the same once trimmed", () => {
        expect(
          validateCharacter(
            { name: "  Alice  ", homeWorld: "Raiden" },
            [alice],
            regions,
          ),
        ).toBe("There's already a character named Alice on Raiden.");
      });

      it("should let the character the details belong to keep its own name and world", () => {
        expect(
          validateCharacter(
            { name: "Alice", homeWorld: "Raiden" },
            [alice],
            regions,
            "alice",
          ),
        ).toBeUndefined();
      });
    });
  });

  describe("validateRetainer", () => {
    describe("a retainer nothing is wrong with", () => {
      it("should give no reason at all", () => {
        expect(
          validateRetainer(
            { name: "Cleo", city: "Kugane" },
            [bella],
            marketBoardCities,
          ),
        ).toBeUndefined();
      });
    });

    describe("the name", () => {
      it.each(["", "   "])(
        "should give a reason for %o, which is no name at all",
        (name) => {
          expect(
            validateRetainer({ name, city: "Ul'dah" }, [], marketBoardCities),
          ).toBe("A name is needed.");
        },
      );
    });

    describe("the city", () => {
      it("should name a city that has no market board", () => {
        expect(
          validateRetainer(
            { name: "Cleo", city: "Nowhere" },
            [],
            marketBoardCities,
          ),
        ).toBe("Nowhere isn't a market board city.");
      });

      it("should still read sensibly when no city was given", () => {
        expect(
          validateRetainer({ name: "Cleo", city: "" }, [], marketBoardCities),
        ).toBe("That isn't a market board city.");
      });
    });

    describe("a name another of the character's retainers already has", () => {
      it("should name the retainer it clashes with", () => {
        expect(
          validateRetainer(
            { name: "Bella", city: "Kugane" },
            [bella],
            marketBoardCities,
          ),
        ).toBe("This character already has a retainer named Bella.");
      });

      it("should let the retainer the details belong to keep its own name", () => {
        expect(
          validateRetainer(
            { name: "Bella", city: "Kugane" },
            [bella],
            marketBoardCities,
            "bella",
          ),
        ).toBeUndefined();
      });
    });
  });
});
