import type { SellListingStatus } from "../../types";
import { formatGil } from "../../utils/format";
import { Badge } from "./Badge";

/** Marks an item whose listing of ours has been undercut, listing the cheaper competition. */
export const UndercutBadge = ({
  status,
}: {
  status: Extract<SellListingStatus, { state: "undercut" }>;
}) => {
  return (
    <Badge
      className="undercut-badge"
      tooltip={
        <>
          <div>
            Your listing: {formatGil(status.ourPricePerUnit)} (rank #
            {status.rank})
          </div>
          <table className="undercut-listings">
            <thead>
              <tr>
                <th>Retainer</th>
                <th>Price</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {status.cheapestListings.map((listing, index) => (
                <tr
                  key={index}
                  className={listing.ours ? "own-listing" : undefined}
                >
                  <td>{listing.retainerName}</td>
                  <td>{formatGil(listing.pricePerUnit)}</td>
                  <td>{listing.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      }
    >
      undercut
    </Badge>
  );
};
