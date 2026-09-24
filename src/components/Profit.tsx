import { formatGil } from "../utils/format";

/** A profit in gil, green for a gain (or breaking even) and red for a loss. */
export const Profit = ({ amount }: { amount?: number }) => (
  <span
    className={
      amount === undefined ? undefined : amount >= 0 ? "positive" : "negative"
    }
  >
    {formatGil(amount)}
  </span>
);
