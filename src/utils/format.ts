// One formatter, shared: a number's toLocaleString() sets a new one up on every call, which adds
// up across a table of thousands of rows. It formats the same way, in the viewer's locale.
const numberFormat = new Intl.NumberFormat();

/** A number with the viewer's locale's separators. */
export const formatNumber = (value: number): string =>
  numberFormat.format(value);

export const formatGil = (value?: number): string => {
  if (value === undefined || Number.isNaN(value)) return "—";
  return formatNumber(Math.round(value));
};
