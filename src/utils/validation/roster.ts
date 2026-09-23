import type { Character, RegionInfo, Retainer } from "../../types";
import { findRegionNameForWorld } from "../worldDirectory";
// Type-only, so the rules and the service that uses them aren't a cycle at runtime.
import type {
  CharacterDetails,
  RetainerDetails,
} from "../../services/characterService";

/** What's wrong with a change to the character roster. */
export type RosterValidationError =
  | { reason: "missing-name" }
  | { reason: "unknown-world"; world: string }
  | { reason: "unknown-city"; city: string }
  | { reason: "duplicate-character"; name: string; world: string }
  | { reason: "duplicate-retainer"; name: string };

/** The reference data a change to the roster is checked against. */
export interface ReferenceData {
  regions: RegionInfo[];
  marketBoardCities: string[];
}

export const tidyCharacterDetails = ({
  name,
  homeWorld,
  note,
}: CharacterDetails): CharacterDetails => ({
  name: name.trim(),
  homeWorld,
  note: note?.trim() || undefined,
});

export const tidyRetainerDetails = ({
  name,
  city,
}: RetainerDetails): RetainerDetails => ({
  name: name.trim(),
  city,
});

/**
 * Why the character can't be in the roster as it is, if there's a reason.
 * `excludingId` is the character the details belong to, which isn't a duplicate
 * of itself. Details are tidied first, so a caller gets the same answer whether
 * or not it has tidied them already.
 */
export const validateCharacter = (
  details: CharacterDetails,
  roster: Character[],
  { regions }: ReferenceData,
  { excludingId }: { excludingId?: string } = {},
): RosterValidationError | undefined => {
  const { name, homeWorld } = tidyCharacterDetails(details);
  if (name === "") return { reason: "missing-name" };
  if (findRegionNameForWorld(homeWorld, regions) === undefined) {
    return { reason: "unknown-world", world: homeWorld };
  }
  // Names are only unique within a world in-game, so the same name on two worlds is two characters.
  const isDuplicate = roster.some(
    (other) =>
      other.id !== excludingId &&
      other.name === name &&
      other.homeWorld === homeWorld,
  );
  if (isDuplicate)
    return { reason: "duplicate-character", name, world: homeWorld };
  return undefined;
};

/**
 * Why the retainer can't be one of its character's retainers as it is, if
 * there's a reason. `excludingId` is the retainer the details belong to, which
 * isn't a duplicate of itself.
 */
export const validateRetainer = (
  details: RetainerDetails,
  retainers: Retainer[],
  { marketBoardCities }: ReferenceData,
  { excludingId }: { excludingId?: string } = {},
): RosterValidationError | undefined => {
  const { name, city } = tidyRetainerDetails(details);
  if (name === "") return { reason: "missing-name" };
  if (!marketBoardCities.includes(city)) {
    return { reason: "unknown-city", city };
  }
  const isDuplicate = retainers.some(
    (other) => other.id !== excludingId && other.name === name,
  );
  if (isDuplicate) return { reason: "duplicate-retainer", name };
  return undefined;
};
