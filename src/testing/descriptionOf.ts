/** The text an element is described by, through aria-describedby — e.g. the tooltip explaining it. */
export const descriptionOf = (element: Element | null): string | null => {
  const id = element?.getAttribute("aria-describedby");
  return (id ? document.getElementById(id)?.textContent : null) ?? null;
};
