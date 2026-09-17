import type { SellListingStatus } from "../types";
import { formatGil } from "../utils/format";

export const UndercutBadge = ({
  status,
}: {
  status: Extract<SellListingStatus, { state: "undercut" }>;
}) => {
  return (
    <span className="undercut-badge">
      undercut
      <span className="undercut-tooltip">
        <div>
          Your listing: {formatGil(status.ourPricePerUnit)} (rank #{status.rank}
          )
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
      </span>
    </span>
  );
};
