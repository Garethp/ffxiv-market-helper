import type { ItemSaleVelocity } from "../api/universalis";

/** A finished scan of every marketable item's sale velocity on one world or data center. */
export interface CompletedScan {
  worldOrDataCenter: string;
  /** When the scan finished, in milliseconds since the Unix epoch. */
  completedAt: number;
  items: ItemSaleVelocity[];
}

/**
 * Source of the most recent completed sale velocity scan for each world or
 * data center, so it can be shown without rescanning on every visit.
 * Implementations can be swapped out (e.g. for one backed by a real
 * database/API) without touching any calling code.
 */
export interface ScanResultsService {
  /** The most recent completed scan of this world or data center, or null if there isn't one recent enough to show. */
  getLatestScan(worldOrDataCenter: string): Promise<CompletedScan | null>;
  /** Replaces the most recent completed scan of the scan's world or data center. */
  saveScan(scan: CompletedScan): Promise<void>;
}

/** How long a completed scan stays recent enough to show. */
const MAX_SCAN_AGE_MS = 12 * 60 * 60_000;

// Versioned so a later change to CompletedScan's shape can't be misread from an older save.
const STORAGE_KEY_PREFIX = "ffxiv-trading:latest-scan:v1:";

/**
 * Keeps the most recent completed scan of each world or data center in this
 * browser's localStorage. A full scan is large and localStorage is limited to
 * a few megabytes, so saving a scan also clears out any that are too old to
 * show.
 */
class LocalStorageScanResultsService implements ScanResultsService {
  async getLatestScan(
    worldOrDataCenter: string,
  ): Promise<CompletedScan | null> {
    const scan = this.read(STORAGE_KEY_PREFIX + worldOrDataCenter);
    return scan !== null && this.isRecent(scan) ? scan : null;
  }

  async saveScan(scan: CompletedScan): Promise<void> {
    this.removeOutdatedScans();
    localStorage.setItem(
      STORAGE_KEY_PREFIX + scan.worldOrDataCenter,
      JSON.stringify(scan),
    );
  }

  private read(key: string): CompletedScan | null {
    const stored = localStorage.getItem(key);
    if (stored === null) return null;
    try {
      return JSON.parse(stored) as CompletedScan;
    } catch {
      return null;
    }
  }

  private isRecent(scan: CompletedScan): boolean {
    return Date.now() - scan.completedAt < MAX_SCAN_AGE_MS;
  }

  /** Removes saved scans that are too old to show, or unreadable. */
  private removeOutdatedScans(): void {
    // Collected up front, since removing items while walking localStorage by index would skip some.
    const scanKeys = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i)!,
    ).filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
    for (const key of scanKeys) {
      const scan = this.read(key);
      if (scan === null || !this.isRecent(scan)) localStorage.removeItem(key);
    }
  }
}

export const scanResultsService: ScanResultsService =
  new LocalStorageScanResultsService();
