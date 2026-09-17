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
          <table>
            <thead>
              <tr>
                <th>Price</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {status.cheaperListings.map((listing, index) => (
                <tr key={index}>
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
