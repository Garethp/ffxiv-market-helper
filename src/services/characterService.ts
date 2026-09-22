import type { Character, Retainer } from "../types";
import {
  configService,
  personalConfig,
  type ConfigService,
} from "./configService";
import {
  validateCharacter,
  validateRetainer,
  tidyCharacterDetails,
  tidyRetainerDetails,
  type ReferenceData,
  type RosterValidationError,
} from "../utils/validation/roster";
import { StoredList } from "./StoredList";

/** A character's own details, as entered: everything but its ID and its retainers, which are managed separately. */
export type CharacterDetails = Omit<Character, "id" | "retainers">;

/** A retainer's details, as entered: everything but its ID. */
export type RetainerDetails = Omit<Retainer, "id">;

/** A character and its retainers, before any of them have been given an ID. */
export type NewCharacter = CharacterDetails & { retainers: RetainerDetails[] };

/**
 * What went wrong with a change to the character roster: a rule the caller was
 * meant to validate first, or a character or retainer that's no longer in the
 * roster.
 */
export type RosterChangeFailure =
  | RosterValidationError
  | { reason: "character-not-found" }
  | { reason: "retainer-not-found" };

/**
 * A change to the roster that couldn't be made. Callers validate first, so this
 * reaching the UI means something the user can't act on — a stale screen, or a
 * caller that skipped its checks.
 */
export class RosterChangeError extends Error {
  constructor(readonly failure: RosterChangeFailure) {
    super(`The roster couldn't make the change: ${failure.reason}`);
    this.name = "RosterChangeError";
  }
}

/**
 * Source of our character roster, and where changes to it are made.
 * Implementations can be swapped out (e.g. for one backed by a real
 * database/API) without touching any calling code.
 */
export interface CharacterService {
  getCharacters(): Promise<Character[]>;
  addCharacter(details: CharacterDetails): Promise<void>;
  /** Replaces the character's details. Its retainers are left as they are. */
  updateCharacter(
    characterId: string,
    details: CharacterDetails,
  ): Promise<void>;
  /** Removes the character along with its retainers. */
  removeCharacter(characterId: string): Promise<void>;
  addRetainer(characterId: string, details: RetainerDetails): Promise<void>;
  updateRetainer(
    characterId: string,
    retainerId: string,
    details: RetainerDetails,
  ): Promise<void>;
  removeRetainer(characterId: string, retainerId: string): Promise<void>;
}

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

  addCharacter(details: CharacterDetails): Promise<void> {
    return this.changeRoster((roster, reference) => {
      const tidied = tidyCharacterDetails(details);
      const character: Character = {
        id: crypto.randomUUID(),
        ...tidied,
        retainers: [],
      };
      return (
        validateCharacter(tidied, roster, reference) ?? [...roster, character]
      );
    });
  }

  updateCharacter(
    characterId: string,
    details: CharacterDetails,
  ): Promise<void> {
    return this.changeRoster((roster, reference) => {
      const existing = roster.find(({ id }) => id === characterId);
      if (!existing) return { reason: "character-not-found" };
      const character = { ...existing, ...tidyCharacterDetails(details) };
      return (
        validateCharacter(character, roster, reference, {
          excludingId: characterId,
        }) ??
        roster.map((other) => (other.id === characterId ? character : other))
      );
    });
  }

  removeCharacter(characterId: string): Promise<void> {
    return this.changeRoster((roster) =>
      roster.some(({ id }) => id === characterId)
        ? roster.filter(({ id }) => id !== characterId)
        : { reason: "character-not-found" },
    );
  }

  addRetainer(characterId: string, details: RetainerDetails): Promise<void> {
    return this.changeRetainers(characterId, (retainers, reference) => {
      const tidied = tidyRetainerDetails(details);
      const retainer: Retainer = { id: crypto.randomUUID(), ...tidied };
      return (
        validateRetainer(tidied, retainers, reference) ?? [
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
  ): Promise<void> {
    return this.changeRetainers(characterId, (retainers, reference) => {
      const existing = retainers.find(({ id }) => id === retainerId);
      if (!existing) return { reason: "retainer-not-found" };
      const retainer = { ...existing, ...tidyRetainerDetails(details) };
      return (
        validateRetainer(retainer, retainers, reference, {
          excludingId: retainerId,
        }) ??
        retainers.map((other) => (other.id === retainerId ? retainer : other))
      );
    });
  }

  removeRetainer(characterId: string, retainerId: string): Promise<void> {
    return this.changeRetainers(characterId, (retainers) =>
      retainers.some(({ id }) => id === retainerId)
        ? retainers.filter(({ id }) => id !== retainerId)
        : { reason: "retainer-not-found" },
    );
  }

  /** Saves the roster `change` makes from the current one, or rejects with what it gave as the reason not to. */
  private async changeRoster(
    change: (
      roster: Character[],
      reference: ReferenceData,
    ) => Character[] | RosterChangeFailure,
  ): Promise<void> {
    const [regions, marketBoardCities] = await Promise.all([
      this.config.getRegions(),
      this.config.getMarketBoardCities(),
    ]);
    // Read only after the reference data has loaded, so nothing saved in the meantime is lost.
    const changed = change(this.storedRoster.read(), {
      regions,
      marketBoardCities,
    });
    if (!Array.isArray(changed)) throw new RosterChangeError(changed);
    this.storedRoster.write(changed);
  }

  /** Saves the retainers `change` makes from one character's current ones, or rejects with what it gave as the reason not to. */
  private changeRetainers(
    characterId: string,
    change: (
      retainers: Retainer[],
      reference: ReferenceData,
    ) => Retainer[] | RosterChangeFailure,
  ): Promise<void> {
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
