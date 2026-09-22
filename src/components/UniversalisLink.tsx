import type { AnchorHTMLAttributes } from "react";
import { buildMarketPageUrl } from "../api/universalis";

/**
 * A link to an item's market page on Universalis for a world or data center, opened in a new tab
 * that can't reach back into this one. Anything else a link can take is passed on, such as a
 * label for one that's only an icon.
 */
export const UniversalisLink = ({
  itemId,
  worldOrDataCenter,
  ...link
}: {
  itemId: number;
  worldOrDataCenter: string;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "target" | "rel"
>) => (
  <a
    {...link}
    href={buildMarketPageUrl(itemId, worldOrDataCenter)}
    target="_blank"
    rel="noopener noreferrer"
  />
);
