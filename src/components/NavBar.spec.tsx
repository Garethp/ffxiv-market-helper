// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { Character } from "../types";
import { NavBar } from "./NavBar";

const alice: Character = {
  id: "alice",
  name: "Alice",
  homeWorld: "WorldA",
  retainers: [],
};
const bob: Character = {
  id: "bob",
  name: "Bob",
  homeWorld: "WorldB",
  retainers: [],
};

/** Shows where the navbar has taken us. */
const CurrentPath = () => <output>{useLocation().pathname}</output>;

const renderNavBar = ({
  path = "/",
  characters = [alice, bob],
  currentCharacter = alice,
  onSelectCharacter = () => {},
}: {
  path?: string;
  characters?: Character[];
  currentCharacter?: Character | null;
  onSelectCharacter?: (character: Character) => void;
} = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavBar
        characters={characters}
        currentCharacter={currentCharacter}
        onSelectCharacter={onSelectCharacter}
      />
      <CurrentPath />
    </MemoryRouter>,
  );

const pagesMarkedCurrent = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

afterEach(cleanup);

describe("NavBar", () => {
  describe("moving between pages", () => {
    it.each([
      ["/", "Tracked Items"],
      ["/high-volume-items", "High Volume Items"],
    ])(
      "should mark only the page being viewed as current on %s",
      (path: string, linkName: string) => {
        renderNavBar({ path });

        expect(pagesMarkedCurrent()).toEqual([linkName]);
      },
    );
  });

  describe("tucking the page links into a menu on a narrow screen", () => {
    const menuButton = () => screen.getByRole("button", { name: "Menu" });
    const isMenuOpen = () => {
      const menu = document.getElementById(
        menuButton().getAttribute("aria-controls")!,
      )!;
      const expanded = menuButton().getAttribute("aria-expanded") === "true";
      expect(menu.classList.contains("navbar-links-open")).toBe(expanded);
      return expanded;
    };
    const openMenu = () => fireEvent.click(menuButton());

    it("should put the link to the source in the menu along with the page links", () => {
      renderNavBar();

      const menu = document.getElementById(
        menuButton().getAttribute("aria-controls")!,
      )!;
      expect(
        menu.contains(screen.getByRole("link", { name: "Source on GitHub" })),
      ).toBe(true);
    });

    it("should keep the menu closed until its button is pressed", () => {
      renderNavBar();

      expect(isMenuOpen()).toBe(false);
      openMenu();
      expect(isMenuOpen()).toBe(true);
    });

    it("should close the menu when its button is pressed again", () => {
      renderNavBar();
      openMenu();

      fireEvent.click(menuButton());

      expect(isMenuOpen()).toBe(false);
    });

    it("should close the menu once a page is picked from it, and go to that page", () => {
      renderNavBar();
      openMenu();

      fireEvent.click(screen.getByRole("link", { name: "Characters" }));

      expect(isMenuOpen()).toBe(false);
      expect(screen.getByRole("status").textContent).toBe("/characters");
    });

    it("should close the menu when the page behind it is tapped", () => {
      const { container } = renderNavBar();
      openMenu();

      fireEvent.click(container.querySelector(".navbar-backdrop")!);

      expect(isMenuOpen()).toBe(false);
    });

    it("should close the menu on Escape, handing focus back to its button", () => {
      renderNavBar();
      openMenu();
      screen.getByRole("link", { name: "Characters" }).focus();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(isMenuOpen()).toBe(false);
      expect(document.activeElement).toBe(menuButton());
    });

    it("should leave focus where it is on Escape while the menu is closed", () => {
      renderNavBar();
      const link = screen.getByRole("link", { name: "Characters" });
      link.focus();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(document.activeElement).toBe(link);
    });

    it("should leave the page behind uncovered while the menu is closed", () => {
      const { container } = renderNavBar();
      openMenu();
      fireEvent.click(menuButton());

      expect(container.querySelector(".navbar-backdrop")).toBeNull();
    });
  });
});
