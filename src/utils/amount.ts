/** Shorthand suffixes for typing amounts, largest first so formatting prefers the most compact one. */
const SUFFIXES = [
  { suffix: "b", multiplier: 1_000_000_000 },
  { suffix: "m", multiplier: 1_000_000 },
  { suffix: "k", multiplier: 1_000 },
];

/** The most decimal places shown before a suffix when formatting, e.g. "1.25m". */
const MAX_SUFFIX_DECIMALS = 2;

export type ParsedAmount =
  | { status: "empty" }
  | { status: "valid"; value: number }
  | { status: "invalid" };

/**
 * Reads an amount typed the way gil is usually written: a plain number
 * ("1500000", "1,500,000") or one with a k/m/b suffix ("500k", "1.5m"), in
 * either case, with or without a space before the suffix.
 */
export const parseAmount = (text: string): ParsedAmount => {
  const trimmed = text.trim().replace(/,/g, "");
  if (trimmed === "") return { status: "empty" };

  const match = /^(-?(?:\d+\.?\d*|\.\d+))\s*([kmb])?$/i.exec(trimmed);
  if (!match) return { status: "invalid" };

  const [, digits, suffix] = match;
  const multiplier =
    SUFFIXES.find((s) => s.suffix === suffix?.toLowerCase())?.multiplier ?? 1;
  return { status: "valid", value: scale(Number(digits), multiplier) };
};

/** Multiplies without floating-point noise, e.g. 1.1 × 1,000,000 = 1,100,000 rather than 1,100,000.0000000002. */
const scale = (value: number, multiplier: number): number =>
  Number((value * multiplier).toPrecision(15));

/**
 * Writes an amount the way it'd be typed: with the largest suffix that
 * represents it exactly in a couple of decimal places ("500k", "1.25m"), or
 * as a plain number otherwise. Always reads back to the same value via
 * parseAmount.
 */
export const formatAmount = (value: number): string => {
  for (const { suffix, multiplier } of SUFFIXES) {
    if (Math.abs(value) < multiplier) continue;
    const scaled = value / multiplier;
    const rounded = Number(scaled.toFixed(MAX_SUFFIX_DECIMALS));
    if (scale(rounded, multiplier) === value) return `${rounded}${suffix}`;
  }
  return String(value);
};
