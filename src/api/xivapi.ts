import { RequestLimitedApiClient } from "./RequestLimitedApiClient";
import { CrossTabRequestLimiter } from "../requestLimiting/CrossTabRequestLimiter";
import { chunk } from "../utils/chunk";

const ITEM_SHEET_URL = "https://v2.xivapi.com/api/sheet/Item";
const GC_SUPPLY_DUTY_REWARD_SHEET_URL =
  "https://v2.xivapi.com/api/sheet/GCSupplyDutyReward";
const SEARCH_URL = "https://v2.xivapi.com/api/search";

// A conservative budget for being a polite citizen, shared by every open tab.
const limiter = new CrossTabRequestLimiter("xivapi", {
  maxConcurrent: 3,
  maxRequestsPerSecond: 10,
});

const client = new RequestLimitedApiClient(limiter, "interactive");

/** The most results an item search returns: enough to find an item by part of its name, without a long list to pick from. */
const ITEM_SEARCH_RESULT_LIMIT = 20;

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
  const url = `${ITEM_SHEET_URL}?rows=${itemIds.join(",")}&fields=Name`;
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

/** What XIVAPI knows about an item that's needed to track it. */
export interface ItemDetails {
  name: string;
  stackSize: number;
}

/** Looks up an item by its ID, giving nothing for an ID that isn't a real, named item. */
export const fetchItem = async (
  itemId: number,
  options: { signal?: AbortSignal } = {},
): Promise<ItemDetails | null> => {
  const response = await client.fetch(
    `${ITEM_SHEET_URL}/${itemId}?fields=Name,StackSize`,
    { signal: options.signal },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`XIVAPI item request failed (${response.status})`);
  }

  const { fields } = (await response.json()) as {
    fields: { Name: string; StackSize: number };
  };
  return fields.Name === ""
    ? null
    : { name: fields.Name, stackSize: fields.StackSize };
};

/** An item found by searching for its name. */
export type ItemSearchResult = ItemDetails & { itemId: number };

/**
 * Finds items that can be sold on the market board whose names contain the
 * text, ignoring case, best match first.
 */
export const searchItems = async (
  text: string,
  options: { signal?: AbortSignal } = {},
): Promise<ItemSearchResult[]> => {
  // A quote or backslash would end or escape the quoted text in XIVAPI's query syntax.
  const searchText = text.replace(/["\\]/g, "").trim();
  const params = new URLSearchParams({
    sheets: "Item",
    // An item with no market board category can't be sold there.
    query: `+Name~"${searchText}" -ItemSearchCategory=0`,
    fields: "Name,StackSize",
    limit: String(ITEM_SEARCH_RESULT_LIMIT),
  });

  const response = await client.fetch(`${SEARCH_URL}?${params}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`XIVAPI item search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    results: { row_id: number; fields: { Name: string; StackSize: number } }[];
  };
  return data.results.map(({ row_id, fields }) => ({
    itemId: row_id,
    name: fields.Name,
    stackSize: fields.StackSize,
  }));
};

/** The most rows XIVAPI gives in one page of a sheet listing or a search. */
const MAX_PAGE_SIZE = 500;

/**
 * How many Company Seals an Expert Delivery hands in for, by the item level
 * of the item delivered. NQ and HQ are worth the same.
 */
export const fetchExpertDeliverySealsByItemLevel = async (): Promise<
  Map<number, number>
> => {
  const sealsByItemLevel = new Map<number, number>();
  let lastRowId: number | undefined;
  // Pages until an empty one, rather than stopping at a short page, in case XIVAPI's page size is smaller than asked for.
  for (;;) {
    const params = new URLSearchParams({
      fields: "SealsExpertDelivery",
      limit: String(MAX_PAGE_SIZE),
    });
    if (lastRowId !== undefined) params.set("after", String(lastRowId));

    const response = await client.fetch(
      `${GC_SUPPLY_DUTY_REWARD_SHEET_URL}?${params}`,
    );
    if (!response.ok) {
      throw new Error(
        `XIVAPI Expert Delivery seals request failed (${response.status})`,
      );
    }

    const { rows } = (await response.json()) as {
      rows: { row_id: number; fields: { SealsExpertDelivery: number } }[];
    };
    if (rows.length === 0) return sealsByItemLevel;
    rows.forEach(({ row_id, fields }) =>
      sealsByItemLevel.set(row_id, fields.SealsExpertDelivery),
    );
    lastRowId = rows[rows.length - 1].row_id;
  }
};

/** An item that can be handed in for an Expert Delivery. */
export interface ExpertDeliveryCandidate {
  itemId: number;
  name: string;
  itemLevel: number;
}

/**
 * Equipment that's green, blue or aetherial, can be sold to a vendor, and can
 * be sold on the market board. Only items bought from the market board are of
 * interest, so untradeable ones are left out even though they can be handed in.
 */
const EXPERT_DELIVERY_CANDIDATE_QUERY =
  "+EquipSlotCategory>0 +(Rarity=2 Rarity=3 Rarity=7) -PriceLow=0 -ItemSearchCategory=0";

/**
 * Every item on the market board that can be handed in for an Expert
 * Delivery. Items the Calamity Salvager sells can't be handed in either, but
 * there's no data to tell them apart; they're nearly all untradeable anyway.
 */
export const fetchExpertDeliveryCandidates = async (): Promise<
  ExpertDeliveryCandidate[]
> => {
  const fields = "Name,LevelItem@as(raw)";
  const limit = String(MAX_PAGE_SIZE);
  const candidates: ExpertDeliveryCandidate[] = [];
  let params = new URLSearchParams({
    sheets: "Item",
    query: EXPERT_DELIVERY_CANDIDATE_QUERY,
    fields,
    limit,
  });
  for (;;) {
    const response = await client.fetch(`${SEARCH_URL}?${params}`);
    if (!response.ok) {
      throw new Error(
        `XIVAPI Expert Delivery item search failed (${response.status})`,
      );
    }

    const data = (await response.json()) as {
      next?: string;
      results: {
        row_id: number;
        fields: { Name: string; "LevelItem@as(raw)": number };
      }[];
    };
    data.results.forEach(({ row_id, fields }) =>
      candidates.push({
        itemId: row_id,
        name: fields.Name,
        itemLevel: fields["LevelItem@as(raw)"],
      }),
    );
    if (data.next === undefined) return candidates;
    // A cursor carries on the same search, but not which fields to give.
    params = new URLSearchParams({ cursor: data.next, fields, limit });
  }
};
