export const formatGil = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString();
};
