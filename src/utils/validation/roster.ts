import type { Character, RegionInfo, Retainer } from "../../types";
import { findRegionNameForWorld } from "../worldDirectory";
// Type-only, so the rules and the service that uses them aren't a cycle at runtime.
import type {
  CharacterDetails,
  RetainerDetails,
} from "../../services/characterService";

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
 * Why the character can't be in the roster as it is, worded for the user to
 * read, or nothing if there's no reason. `excludingId` is the character the
 * details belong to, which isn't a duplicate of itself. Details are tidied
 * first, so a caller gets the same answer whether or not it has tidied them
 * already.
 */
export const validateCharacter = (
  details: CharacterDetails,
  roster: Character[],
  regions: RegionInfo[],
  excludingId?: string,
): string | undefined => {
  const { name, homeWorld } = tidyCharacterDetails(details);
  if (name === "") return "A name is needed.";
  if (findRegionNameForWorld(homeWorld, regions) === undefined) {
    return `${homeWorld || "That"} isn't a known world.`;
  }
  // Names are only unique within a world in-game, so the same name on two worlds is two characters.
  const isDuplicate = roster.some(
    (other) =>
      other.id !== excludingId &&
      other.name === name &&
      other.homeWorld === homeWorld,
  );
  if (isDuplicate) {
    return `There's already a character named ${name} on ${homeWorld}.`;
  }
  return undefined;
};

/**
 * Why the retainer can't be one of its character's retainers as it is, worded
 * for the user to read, or nothing if there's no reason. `excludingId` is the
 * retainer the details belong to, which isn't a duplicate of itself.
 */
export const validateRetainer = (
  details: RetainerDetails,
  retainers: Retainer[],
  marketBoardCities: string[],
  excludingId?: string,
): string | undefined => {
  const { name, city } = tidyRetainerDetails(details);
  if (name === "") return "A name is needed.";
  if (!marketBoardCities.includes(city)) {
    return `${city || "That"} isn't a market board city.`;
  }
  const isDuplicate = retainers.some(
    (other) => other.id !== excludingId && other.name === name,
  );
  if (isDuplicate) {
    return `This character already has a retainer named ${name}.`;
  }
  return undefined;
};
