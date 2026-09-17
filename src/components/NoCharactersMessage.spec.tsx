// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { NoCharactersMessage } from "./NoCharactersMessage";

const renderMessage = () =>
  render(
    <MemoryRouter>
      <NoCharactersMessage />
    </MemoryRouter>,
  );

afterEach(cleanup);

describe("NoCharactersMessage", () => {
  it("should title the page as a welcome", () => {
    renderMessage();

    expect(document.title).toBe("Welcome");
    expect(screen.getByRole("heading", { name: "Welcome!" })).not.toBeNull();
  });

  it("should explain that a character and its retainers need adding before prices can be worked out", () => {
    renderMessage();

    expect(
      screen.getByText(/Before any prices can be worked out, add a character/),
    ).not.toBeNull();
    expect(screen.getByText(/Add its retainers as well/)).not.toBeNull();
  });

  it("should link to where characters are added", () => {
    renderMessage();

    const link = screen.getByRole("link", {
      name: "Add your first character",
    });
    expect(link.getAttribute("href")).toBe("/characters");
  });
});
