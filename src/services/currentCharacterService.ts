/**
 * Remembers which character was last picked as the Current Character, so
 * every page and tab starts out on it. Implementations can be swapped out
 * (e.g. for one backed by a real database/API) without touching any calling
 * code.
 */
export interface CurrentCharacterService {
  /** The ID of the character last picked, or nothing if none has been. */
  getCurrentCharacterId(): Promise<string | undefined>;
  setCurrentCharacterId(id: string): Promise<void>;
}

const STORAGE_KEY = "ffxiv-trading:current-character";

/** Remembers the Current Character in this browser's localStorage, shared by every tab. */
class LocalStorageCurrentCharacterService implements CurrentCharacterService {
  async getCurrentCharacterId(): Promise<string | undefined> {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  }

  async setCurrentCharacterId(id: string): Promise<void> {
    localStorage.setItem(STORAGE_KEY, id);
  }
}

export const currentCharacterService: CurrentCharacterService =
  new LocalStorageCurrentCharacterService();
