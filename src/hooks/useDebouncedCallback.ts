import { useCallback, useEffect, useRef } from "react";

/**
 * A function that calls `callback` once calls to it pause for `delayMs`, with
 * the arguments of the last call. Every call restarts the wait, even one with
 * the same arguments as the last. The latest `callback` is the one called,
 * and nothing is called once the component has gone.
 */
export const useDebouncedCallback = <Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): ((...args: Args) => void) => {
  const latestCallback = useRef(callback);
  useEffect(() => {
    latestCallback.current = callback;
  });

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (...args: Args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(
        () => latestCallback.current(...args),
        delayMs,
      );
    },
    [delayMs],
  );
};
