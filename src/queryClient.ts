import { focusManager, QueryClient } from "@tanstack/react-query";

// TanStack Query pauses polling and retries while the page is hidden. A page left open in a
// background tab (e.g. tracked items, while a scan runs in another) should keep
// refreshing, so it's told the page is always focused.
focusManager.setFocused(true);

/**
 * TanStack Query retries failed fetches and refetches whenever the window
 * regains focus or the network reconnects, unless told otherwise. None of the
 * app's pages fetch like that, so those are off by default; a query that
 * wants them can turn them back on.
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
