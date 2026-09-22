import { useSyncExternalStore } from "react";

/** A phone's width, below which pages switch to their narrow layouts. The stylesheet repeats it. */
export const narrowScreenMaxWidthPx = 640;

const narrowScreenQuery = `(max-width: ${narrowScreenMaxWidthPx}px)`;

// Without `matchMedia` (as when rendered outside a browser), the screen is taken to be wide.
const subscribe = (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(narrowScreenQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const isNarrowScreen = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia(narrowScreenQuery).matches;

/** Whether the screen is phone-width, kept up to date as the window is resized or turned. */
export const useIsNarrowScreen = (): boolean =>
  useSyncExternalStore(subscribe, isNarrowScreen);
