import { within } from "@testing-library/react";

/** The names of a table's column headers, as they're announced: a header with a hint is named without it. */
export const columnHeaderNames = (container: HTMLElement): string[] =>
  within(container)
    .getAllByRole("columnheader")
    .map(
      (header) => header.getAttribute("aria-label") ?? header.textContent ?? "",
    );
