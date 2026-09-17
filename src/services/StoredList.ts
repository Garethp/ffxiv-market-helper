/**
 * A list kept in this browser's localStorage under one key. The first time
 * it's read in a browser with nothing saved under that key, it starts out as
 * `initial()`. Saved data that can't be read counts as an empty list, rather
 * than a missing one to start out as `initial()` again.
 */
export class StoredList<T> {
  constructor(
    private readonly key: string,
    private readonly initial: () => T[],
  ) {}

  read(): T[] {
    const stored = localStorage.getItem(this.key);
    if (stored === null) {
      const items = this.initial();
      this.write(items);
      return items;
    }
    try {
      return JSON.parse(stored) as T[];
    } catch {
      return [];
    }
  }

  write(items: T[]): void {
    localStorage.setItem(this.key, JSON.stringify(items));
  }
}
