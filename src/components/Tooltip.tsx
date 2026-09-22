import { useEffect, useId, useRef, type ReactNode } from "react";

/** How close to the edge of the screen a tooltip is allowed to come. */
const SCREEN_EDGE_MARGIN_PX = 16;

/**
 * How far to slide a tooltip sideways so it sits within the screen, given where it would sit
 * unmoved. One too wide to fit at all is lined up with the left edge, where its text starts.
 */
const shiftOntoScreen = (
  { left, right }: { left: number; right: number },
  screenWidth: number,
): number => {
  const overRight = right - (screenWidth - SCREEN_EDGE_MARGIN_PX);
  const shift = overRight > 0 ? -overRight : 0;
  return left + shift < SCREEN_EDGE_MARGIN_PX
    ? SCREEN_EDGE_MARGIN_PX - left
    : shift;
};

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
  const tooltipRef = useRef<HTMLSpanElement>(null);

  // The stylesheet shows the tooltip and says which way it opens. This only slides it sideways as
  // it's shown, if it would otherwise run off the screen, measured afresh each time since the page
  // may have moved or resized since the last.
  const keepOnScreen = () => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    tooltip.style.translate = "";
    const shift = shiftOntoScreen(
      tooltip.getBoundingClientRect(),
      document.documentElement.clientWidth,
    );
    if (shift !== 0) tooltip.style.translate = `${shift}px 0`;
  };

  // Some tooltips only fill in once they're open, so where they sit is worked out again whenever
  // their size changes. Sliding one doesn't change its size, so this can't set itself off.
  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(keepOnScreen);
    observer.observe(tooltip);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      className="tooltip-anchor"
      onMouseEnter={keepOnScreen}
      onFocus={keepOnScreen}
    >
      {children(tooltipId)}
      <span ref={tooltipRef} role="tooltip" id={tooltipId} className="tooltip">
        {text}
      </span>
    </span>
  );
};
