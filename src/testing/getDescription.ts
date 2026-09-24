/** The text an element is described by, through aria-describedby — e.g. the tooltip explaining it. */
// Takes null as well, since that's what the DOM gives for an element that isn't there.
export const getDescription = (element: Element | null): string | undefined => {
  const id = element?.getAttribute("aria-describedby");
  return id
    ? (document.getElementById(id)?.textContent ?? undefined)
    : undefined;
};
