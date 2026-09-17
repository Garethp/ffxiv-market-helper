import { useRef } from "react";

/**
 * Tracks the "current" run of an async operation that might be superseded by
 * a newer one before it finishes (e.g. a fetch cycle restarted by a prop
 * change, or React StrictMode's dev-mode mount/cleanup/remount). Using a
 * counter rather than a boolean means a superseded run can never be
 * un-cancelled by a later run resetting a shared flag back to false — each
 * run only trusts the token it captured when it started.
 */
export const useGeneration = () => {
  const ref = useRef(0);
  // Held in a ref so callers get the same object back across renders — it can sit in a dependency
  // array (e.g. of a useEffect/useCallback) without retriggering it on every render.
  const api = useRef({
    /** Starts a new run, superseding whichever one was current before it. */
    start: () => ++ref.current,
    /** Whether the given run is still the current one. */
    isCurrent: (generation: number) => ref.current === generation,
    /** Supersedes the current run without starting a replacement. */
    cancel: () => {
      ref.current++;
    },
  });

  return api.current;
};
