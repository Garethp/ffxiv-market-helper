/** The minimal contract both RequestLimitedApiClient and CachingFetcher implement, so they compose freely. */
export interface Fetcher {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}
