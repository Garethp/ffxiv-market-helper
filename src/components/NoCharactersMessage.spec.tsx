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

describe("NoCharactersMessage", () => {
  afterEach(() => {
    cleanup();
  });

  it("should link to where characters are added", () => {
    renderMessage();

    const link = screen.getByRole("link", {
      name: "Add your first character",
    });
    expect(link.getAttribute("href")).toBe("/characters");
  });
});
