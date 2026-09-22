import { useState, type MouseEvent, type ReactNode } from "react";

/** A list of rows that each open up in place, bordered as one block so it reads like a table. */
export const ExpandableList = ({ children }: { children: ReactNode }) => (
  <ul className="expandable-list">{children}</ul>
);

/**
 * One row of an `ExpandableList`: a heading, with whatever's always shown under it, then a summary
 * while it's collapsed or the details while it's expanded. Tapping anywhere on the row expands or
 * collapses it, bar the links and buttons in it, which do their own thing.
 */
export const ExpandableRow = ({
  heading,
  expandLabel,
  className,
  children,
  summary,
  details,
}: {
  heading: ReactNode;
  /** Names the button that expands the row, e.g. "Show every figure for Wind Cluster". */
  expandLabel: string;
  className?: string;
  /** Shown whether the row is expanded or not. */
  children?: ReactNode;
  summary: ReactNode;
  details: ReactNode;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleExpanded = () => setIsExpanded((expanded) => !expanded);

  return (
    <li
      className={["expandable-list-row", className].filter(Boolean).join(" ")}
      onClick={(event: MouseEvent) => {
        if (!(event.target as Element).closest("a, button")) toggleExpanded();
      }}
    >
      <div className="expandable-list-row-heading">
        {/* The row itself can only be clicked, so this is how it's expanded without a pointer. */}
        <button
          type="button"
          className="expand-row-button"
          aria-expanded={isExpanded}
          aria-label={expandLabel}
          onClick={toggleExpanded}
        >
          {isExpanded ? "▾" : "▸"}
        </button>
        {heading}
      </div>
      {children}
      {isExpanded ? details : summary}
    </li>
  );
};
