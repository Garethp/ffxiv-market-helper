import type { ReactNode } from "react";
import { Tooltip } from "../Tooltip";

/**
 * A small label flagging something about an item, explained by a tooltip. It can be focused, so
 * the explanation can be reached without a pointer.
 */
export const Badge = ({
  className,
  tooltip,
  children,
}: {
  /** Picks the badge's look. */
  className: string;
  tooltip: ReactNode;
  children: ReactNode;
}) => (
  <Tooltip text={tooltip}>
    {(tooltipId) => (
      <span className={className} tabIndex={0} aria-describedby={tooltipId}>
        {children}
      </span>
    )}
  </Tooltip>
);
