/** Retries `fn` exactly once on failure, unless the signal has been aborted by then. */
export const withOneRetry = async <T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (signal?.aborted) throw error;
    return await fn();
  }
};
