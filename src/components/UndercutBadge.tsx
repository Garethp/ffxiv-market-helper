import type { SellListingStatus } from "../types";
import { formatGil } from "../utils/format";
import { Tooltip } from "./Tooltip";

export const UndercutBadge = ({
  status,
}: {
  status: Extract<SellListingStatus, { state: "undercut" }>;
}) => {
  return (
    <Tooltip
      text={
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
      {(tooltipId) => (
        <span
          className="undercut-badge"
          tabIndex={0}
          aria-describedby={tooltipId}
        >
          undercut
        </span>
      )}
    </Tooltip>
  );
};
