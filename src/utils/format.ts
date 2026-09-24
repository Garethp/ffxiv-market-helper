export const formatGil = (value?: number): string => {
  if (value === undefined || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString();
};
