/** Retries `fn` exactly once on failure. */
export const withOneRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch {
    return await fn();
  }
};
