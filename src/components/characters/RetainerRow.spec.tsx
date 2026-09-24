// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetainerRow } from "./RetainerRow";

const renderRow = ({ onRemove = vi.fn() }: { onRemove?: () => void } = {}) => {
  render(
    <MemoryRouter>
      <ul>
        <RetainerRow
          retainer={{ id: "r1", name: "Amarana", city: "Ul'dah" }}
          editHref="/characters/alice/retainers/r1/edit"
          onRemove={onRemove}
        />
      </ul>
    </MemoryRouter>,
  );
  return { onRemove };
};

afterEach(cleanup);

describe("RetainerRow", () => {
  it("should show the retainer with the city it's in", () => {
    renderRow();

    expect(screen.getByRole("listitem").textContent).toContain(
      "Amarana in Ul'dah",
    );
  });

  it("should lead to the page for changing the retainer", () => {
    renderRow();

    expect(
      screen.getByRole("link", { name: "Edit Amarana" }).getAttribute("href"),
    ).toBe("/characters/alice/retainers/r1/edit");
  });

  it("should report the retainer being removed", () => {
    const { onRemove } = renderRow();

    fireEvent.click(screen.getByRole("button", { name: "Remove Amarana" }));

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
