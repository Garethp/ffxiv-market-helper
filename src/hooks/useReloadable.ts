import { useCallback, useEffect, useState } from "react";

/**
 * Reads data when first used, and again whenever `reload` is called — for
 * data that only changes when we change it, so there's no need to keep
 * checking it. Null until the first read finishes. `load` should keep the
 * same identity between renders, or it's read again on every render.
 */
export const useReloadable = <T>(
  load: () => Promise<T>,
): [data: T | null, reload: () => void] => {
  const [data, setData] = useState<T | null>(null);
  const reload = useCallback(() => {
    load().then(setData);
  }, [load]);
  useEffect(() => {
    reload();
  }, [reload]);
  return [data, reload];
};
