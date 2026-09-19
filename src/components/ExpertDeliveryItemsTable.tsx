import {
  sealsPerGil,
  type ExpertDeliveryItem,
  type ExpertDeliveryPrice,
} from "../services/expertDelivery";
import type { RegionInfo } from "../types";
import { formatGil } from "../utils/format";
import { findDataCenterForWorld } from "../utils/worldDirectory";

/** The columns describing where an item can be bought, and what for. */
const PRICE_COLUMN_COUNT = 4;

const PriceCells = ({
  item,
  price,
  regions,
}: {
  item: ExpertDeliveryItem;
  price: ExpertDeliveryPrice | undefined;
  regions: RegionInfo[];
}) => {
  switch (price?.status) {
    case undefined:
      return (
        <td colSpan={PRICE_COLUMN_COUNT} className="muted">
          Loading…
        </td>
      );
    case "unlisted":
      return (
        <td colSpan={PRICE_COLUMN_COUNT} className="muted">
          No listings
        </td>
      );
    case "failed":
      return (
        <td colSpan={PRICE_COLUMN_COUNT} className="muted">
          Couldn't fetch prices
        </td>
      );
    case "listed": {
      const { listing } = price;
      return (
        <>
          <td>{formatGil(listing.pricePerUnit)}</td>
          <td>{sealsPerGil(item, listing).toFixed(2)}</td>
          <td>
            {findDataCenterForWorld(listing.worldName, regions) ?? "Unknown"}
          </td>
          <td>{listing.worldName}</td>
        </>
      );
    }
  }
};

export const ExpertDeliveryItemsTable = ({
  items,
  prices,
  regions,
}: {
  items: ExpertDeliveryItem[];
  prices: Record<number, ExpertDeliveryPrice>;
  /** Where to look up which data center a listing's world is in. */
  regions: RegionInfo[];
}) => (
  <table className="item-table">
    <thead>
      <tr>
        <th>Item</th>
        <th>Item level</th>
        <th>Seals</th>
        <th>Lowest price</th>
        <th>Seals / gil</th>
        <th>Data center</th>
        <th>World</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item) => (
        <tr key={item.itemId}>
          <td>{item.name}</td>
          <td>{item.itemLevel}</td>
          <td>{item.seals.toLocaleString()}</td>
          <PriceCells
            item={item}
            price={prices[item.itemId]}
            regions={regions}
          />
        </tr>
      ))}
    </tbody>
  </table>
);
