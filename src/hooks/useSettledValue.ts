import { useEffect, useState } from "react";

/** The value, once it's stopped changing for `delayMs`. */
export const useSettledValue = <T>(value: T, delayMs: number): T => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return settled;
};
