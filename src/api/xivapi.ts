import { CachingFetcher } from "./CachingFetcher";
import { RequestLimitedApiClient } from "./RequestLimitedApiClient";
import { CrossTabRequestLimiter } from "../requestLimiting/CrossTabRequestLimiter";
import { chunk } from "../utils/chunk";

const BASE_URL = "https://v2.xivapi.com/api/sheet/Item";

// A conservative budget for being a polite citizen, shared by every open tab.
const limiter = new CrossTabRequestLimiter("xivapi", {
  maxConcurrent: 3,
  maxRequestsPerSecond: 10,
});

// Item names never change, so a long cache avoids re-fetching the same names on every scan.
const client = new CachingFetcher(
  new RequestLimitedApiClient(limiter, "interactive"),
  {
    ttlMs: 24 * 60 * 60_000,
  },
);

/** The most row IDs XIVAPI's sheet endpoint returns per request — it silently truncates beyond this. */
const MAX_ROWS_PER_REQUEST = 100;

/**
 * Looks up display names for item IDs via XIVAPI (Universalis itself doesn't
 * provide names). Best-effort: an ID XIVAPI has no name for is simply absent
 * from the result rather than failing the whole lookup.
 */
export const fetchItemNames = async (
  itemIds: number[],
): Promise<Map<number, string>> => {
  if (itemIds.length === 0) return new Map();

  const batches = chunk(itemIds, MAX_ROWS_PER_REQUEST);
  const batchResults = await Promise.all(
    batches.map((batch) => fetchItemNameBatch(batch)),
  );
  return new Map(batchResults.flat());
};

const fetchItemNameBatch = async (
  itemIds: number[],
): Promise<[number, string][]> => {
  const url = `${BASE_URL}?rows=${itemIds.join(",")}&fields=Name`;
  const response = await client.fetch(url);
  if (!response.ok) {
    throw new Error(`XIVAPI item-name request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    rows: { row_id: number; fields: { Name: string } }[];
  };
  return data.rows
    .filter((row) => row.fields.Name !== "")
    .map((row) => [row.row_id, row.fields.Name]);
};
