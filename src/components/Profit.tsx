import { formatGil } from "../utils/format";

/** A profit in gil, green for a gain (or breaking even) and red for a loss. */
export const Profit = ({ amount }: { amount: number | null }) => (
  <span
    className={
      amount === null ? undefined : amount >= 0 ? "positive" : "negative"
    }
  >
    {formatGil(amount)}
  </span>
);
