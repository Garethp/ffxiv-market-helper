/**
 * Remembers which character was last picked as the Current Character, so
 * every page and tab starts out on it. Implementations can be swapped out
 * (e.g. for one backed by a real database/API) without touching any calling
 * code.
 */
export interface CurrentCharacterService {
  /** The name of the character last picked, or null if none has been. */
  getCurrentCharacterName(): Promise<string | null>;
  setCurrentCharacterName(name: string): Promise<void>;
}

const STORAGE_KEY = "ffxiv-trading:current-character";

/** Remembers the Current Character in this browser's localStorage, shared by every tab. */
class LocalStorageCurrentCharacterService implements CurrentCharacterService {
  async getCurrentCharacterName(): Promise<string | null> {
    return localStorage.getItem(STORAGE_KEY);
  }

  async setCurrentCharacterName(name: string): Promise<void> {
    localStorage.setItem(STORAGE_KEY, name);
  }
}

export const currentCharacterService: CurrentCharacterService =
  new LocalStorageCurrentCharacterService();
