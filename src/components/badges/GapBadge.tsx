import { Badge } from "./Badge";

/** Marks an item whose current listings are well above what it's recently sold for. */
export const GapBadge = () => (
  <Badge
    className="gap-badge"
    tooltip="Current listings are well above recent sale prices — room to undercut"
  >
    gap
  </Badge>
);
