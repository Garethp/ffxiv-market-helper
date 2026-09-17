import { useId, type ReactNode } from "react";

/**
 * Extra information about whatever it wraps, shown while that's hovered or
 * focused. The child is given the tooltip's ID and has to point at it, with
 * `aria-describedby` for extra detail about something that already reads
 * sensibly, or `aria-labelledby` to name a control that has no text of its own
 * (an icon). A child that can't be focused on its own needs `tabIndex={0}`, or
 * its tooltip can only be reached with a mouse.
 */
export const Tooltip = ({
  text,
  children,
}: {
  text: ReactNode;
  children: (tooltipId: string) => ReactNode;
}) => {
  const tooltipId = useId();
  return (
    <span className="tooltip-anchor">
      {children(tooltipId)}
      <span role="tooltip" id={tooltipId} className="tooltip">
        {text}
      </span>
    </span>
  );
};
