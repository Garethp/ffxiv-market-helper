import type { Character, RegionInfo, Retainer } from "../types";
import { findRegionNameForWorld } from "../utils/worldDirectory";
import {
  configService,
  personalConfig,
  type ConfigService,
} from "./configService";
import { StoredList } from "./StoredList";

/** A character's own details, as entered: everything but its ID and its retainers, which are managed separately. */
export type CharacterDetails = Omit<Character, "id" | "retainers">;

/** A retainer's details, as entered: everything but its ID. */
export type RetainerDetails = Omit<Retainer, "id">;

/** A character and its retainers, before any of them have been given an ID. */
export type NewCharacter = CharacterDetails & { retainers: RetainerDetails[] };

/** Why a change to the character roster was refused. */
export type RosterChangeError =
  | { reason: "missing-name" }
  | { reason: "unknown-world"; world: string }
  | { reason: "unknown-city"; city: string }
  | { reason: "duplicate-character"; name: string; world: string }
  | { reason: "duplicate-retainer"; name: string }
  | { reason: "character-not-found" }
  | { reason: "retainer-not-found" };

export type RosterChangeResult =
  { ok: true } | { ok: false; error: RosterChangeError };

/**
 * Source of our character roster, and where changes to it are made.
 * Implementations can be swapped out (e.g. for one backed by a real
 * database/API) without touching any calling code.
 */
export interface CharacterService {
  getCharacters(): Promise<Character[]>;
  addCharacter(details: CharacterDetails): Promise<RosterChangeResult>;
  /** Replaces the character's details. Its retainers are left as they are. */
  updateCharacter(
    characterId: string,
    details: CharacterDetails,
  ): Promise<RosterChangeResult>;
  /** Removes the character along with its retainers. */
  removeCharacter(characterId: string): Promise<RosterChangeResult>;
  addRetainer(
    characterId: string,
    details: RetainerDetails,
  ): Promise<RosterChangeResult>;
  updateRetainer(
    characterId: string,
    retainerId: string,
    details: RetainerDetails,
  ): Promise<RosterChangeResult>;
  removeRetainer(
    characterId: string,
    retainerId: string,
  ): Promise<RosterChangeResult>;
}

/** The reference data a change to the roster is checked against. */
interface ReferenceData {
  regions: RegionInfo[];
  marketBoardCities: string[];
}

const tidyCharacterDetails = ({
  name,
  homeWorld,
  note,
}: CharacterDetails): CharacterDetails => ({
  name: name.trim(),
  homeWorld,
  note: note?.trim() || undefined,
});

const tidyRetainerDetails = ({
  name,
  city,
}: RetainerDetails): RetainerDetails => ({
  name: name.trim(),
  city,
});

/** Why the character can't be in the roster as it is, if there's a reason. */
const checkCharacter = (
  character: Character,
  roster: Character[],
  { regions }: ReferenceData,
): RosterChangeError | undefined => {
  if (character.name === "") return { reason: "missing-name" };
  if (findRegionNameForWorld(character.homeWorld, regions) === undefined) {
    return { reason: "unknown-world", world: character.homeWorld };
  }
  // Names are only unique within a world in-game, so the same name on two worlds is two characters.
  const isDuplicate = roster.some(
    (other) =>
      other.id !== character.id &&
      other.name === character.name &&
      other.homeWorld === character.homeWorld,
  );
  if (isDuplicate) {
    return {
      reason: "duplicate-character",
      name: character.name,
      world: character.homeWorld,
    };
  }
  return undefined;
};

/** Why the retainer can't be one of its character's retainers as it is, if there's a reason. */
const checkRetainer = (
  retainer: Retainer,
  retainers: Retainer[],
  { marketBoardCities }: ReferenceData,
): RosterChangeError | undefined => {
  if (retainer.name === "") return { reason: "missing-name" };
  if (!marketBoardCities.includes(retainer.city)) {
    return { reason: "unknown-city", city: retainer.city };
  }
  const isDuplicate = retainers.some(
    (other) => other.id !== retainer.id && other.name === retainer.name,
  );
  if (isDuplicate) return { reason: "duplicate-retainer", name: retainer.name };
  return undefined;
};

const withIds = (character: NewCharacter): Character => ({
  ...character,
  id: crypto.randomUUID(),
  retainers: character.retainers.map((retainer) => ({
    ...retainer,
    id: crypto.randomUUID(),
  })),
});

// Versioned so a later change to Character's shape can't be misread from an older save.
const STORAGE_KEY = "ffxiv-trading:characters:v1";

/**
 * Keeps the character roster in this browser's localStorage. The first time
 * it's loaded in a browser with no roster saved, it starts out as a copy of
 * the initial characters.
 */
export class LocalStorageCharacterService implements CharacterService {
  private readonly storedRoster: StoredList<Character>;

  constructor(
    initialCharacters: NewCharacter[],
    private readonly config: Pick<
      ConfigService,
      "getRegions" | "getMarketBoardCities"
    >,
  ) {
    this.storedRoster = new StoredList(STORAGE_KEY, () =>
      initialCharacters.map(withIds),
    );
  }

  async getCharacters(): Promise<Character[]> {
    return this.storedRoster.read();
  }

  addCharacter(details: CharacterDetails): Promise<RosterChangeResult> {
    return this.changeRoster((roster, reference) => {
      const character: Character = {
        id: crypto.randomUUID(),
        ...tidyCharacterDetails(details),
        retainers: [],
      };
      return (
        checkCharacter(character, roster, reference) ?? [...roster, character]
      );
    });
  }

  updateCharacter(
    characterId: string,
    details: CharacterDetails,
  ): Promise<RosterChangeResult> {
    return this.changeRoster((roster, reference) => {
      const existing = roster.find(({ id }) => id === characterId);
      if (!existing) return { reason: "character-not-found" };
      const character = { ...existing, ...tidyCharacterDetails(details) };
      return (
        checkCharacter(character, roster, reference) ??
        roster.map((other) => (other.id === characterId ? character : other))
      );
    });
  }

  removeCharacter(characterId: string): Promise<RosterChangeResult> {
    return this.changeRoster((roster) =>
      roster.some(({ id }) => id === characterId)
        ? roster.filter(({ id }) => id !== characterId)
        : { reason: "character-not-found" },
    );
  }

  addRetainer(
    characterId: string,
    details: RetainerDetails,
  ): Promise<RosterChangeResult> {
    return this.changeRetainers(characterId, (retainers, reference) => {
      const retainer: Retainer = {
        id: crypto.randomUUID(),
        ...tidyRetainerDetails(details),
      };
      return (
        checkRetainer(retainer, retainers, reference) ?? [
          ...retainers,
          retainer,
        ]
      );
    });
  }

  updateRetainer(
    characterId: string,
    retainerId: string,
    details: RetainerDetails,
  ): Promise<RosterChangeResult> {
    return this.changeRetainers(characterId, (retainers, reference) => {
      const existing = retainers.find(({ id }) => id === retainerId);
      if (!existing) return { reason: "retainer-not-found" };
      const retainer = { ...existing, ...tidyRetainerDetails(details) };
      return (
        checkRetainer(retainer, retainers, reference) ??
        retainers.map((other) => (other.id === retainerId ? retainer : other))
      );
    });
  }

  removeRetainer(
    characterId: string,
    retainerId: string,
  ): Promise<RosterChangeResult> {
    return this.changeRetainers(characterId, (retainers) =>
      retainers.some(({ id }) => id === retainerId)
        ? retainers.filter(({ id }) => id !== retainerId)
        : { reason: "retainer-not-found" },
    );
  }

  /** Saves the roster `change` makes from the current one, unless it gives a reason not to. */
  private async changeRoster(
    change: (
      roster: Character[],
      reference: ReferenceData,
    ) => Character[] | RosterChangeError,
  ): Promise<RosterChangeResult> {
    const [regions, marketBoardCities] = await Promise.all([
      this.config.getRegions(),
      this.config.getMarketBoardCities(),
    ]);
    // Read only after the reference data has loaded, so nothing saved in the meantime is lost.
    const changed = change(this.storedRoster.read(), {
      regions,
      marketBoardCities,
    });
    if (!Array.isArray(changed)) return { ok: false, error: changed };
    this.storedRoster.write(changed);
    return { ok: true };
  }

  /** Saves the retainers `change` makes from one character's current ones, unless it gives a reason not to. */
  private changeRetainers(
    characterId: string,
    change: (
      retainers: Retainer[],
      reference: ReferenceData,
    ) => Retainer[] | RosterChangeError,
  ): Promise<RosterChangeResult> {
    return this.changeRoster((roster, reference) => {
      const character = roster.find(({ id }) => id === characterId);
      if (!character) return { reason: "character-not-found" };
      const retainers = change(character.retainers, reference);
      if (!Array.isArray(retainers)) return retainers;
      return roster.map((other) =>
        other.id === characterId ? { ...other, retainers } : other,
      );
    });
  }
}

export const characterService: CharacterService =
  new LocalStorageCharacterService(
    personalConfig.characters ?? [],
    configService,
  );
