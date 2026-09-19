import {
  averageSealsPerGil,
  bestListing,
  sealsPerGil,
  type ItemToBuy,
} from "../services/expertDelivery";
import type { RegionInfo } from "../types";
import { formatGil } from "../utils/format";
import { findDataCenterForWorld } from "../utils/worldDirectory";
import { FixedWidthColumns } from "./FixedWidthColumns";
import { ItemNameWithCopy } from "./ItemNameWithCopy";

const COLUMNS = [
  { name: "Item", width: "28%" },
  { name: "Lowest price", width: "10%" },
  { name: "Seals / gil", width: "10%" },
  { name: "Seals", width: "9%" },
  { name: "Listings", width: "9%" },
  { name: "Average seals / gil", width: "13%" },
  { name: "World", width: "21%" },
];

/** A world and the data center it's in, or just the world when that isn't known. */
const worldWithDataCenter = (world: string, regions: RegionInfo[]) => {
  const dataCenter = findDataCenterForWorld(world, regions);
  return dataCenter === undefined ? world : `${world} - ${dataCenter}`;
};

/** Each item worth buying, where its best listing is, and how many more there are like it. */
export const ExpertDeliveryItemsTable = ({
  itemsToBuy,
  regions,
  copiedKey,
  onCopy,
}: {
  itemsToBuy: ItemToBuy[];
  /** Where to look up which data center a listing's world is in. */
  regions: RegionInfo[];
  /** The row whose item name was just copied, if any. */
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) => (
  <table className="item-table fixed-columns">
    <FixedWidthColumns columns={COLUMNS} />
    <tbody>
      {itemsToBuy.map((itemToBuy) => {
        const { item } = itemToBuy;
        const best = bestListing(itemToBuy);
        const key = String(item.itemId);
        return (
          <tr key={key}>
            <td>
              <ItemNameWithCopy
                name={item.name}
                isCopied={copiedKey === key}
                onCopy={() => onCopy(key, item.name)}
              />
            </td>
            <td>{formatGil(best.pricePerUnit)}</td>
            <td>{sealsPerGil(item, best).toFixed(2)}</td>
            <td>{item.seals.toLocaleString()}</td>
            <td>{itemToBuy.listings.length.toLocaleString()}</td>
            <td>{averageSealsPerGil(itemToBuy).toFixed(2)}</td>
            <td>{worldWithDataCenter(best.worldName, regions)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);
