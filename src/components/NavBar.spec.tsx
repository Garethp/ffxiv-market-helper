// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const navLink = (name: string) => screen.getByRole("link", { name });

const currentPath = () => screen.getByRole("status").textContent;

const pagesMarkedCurrent = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

afterEach(cleanup);

describe("NavBar", () => {
  describe("the Current Character", () => {
    it("should show the Current Character", () => {
      renderNavBar({ currentCharacter: bob });

      expect(
        screen.getByRole("option", { name: "Bob", selected: true }),
      ).not.toBeNull();
      expect(screen.getByText("WorldB")).not.toBeNull();
    });

    it("should report a character picked from it", () => {
      const onSelectCharacter = vi.fn();
      renderNavBar({ onSelectCharacter });

      fireEvent.change(screen.getByLabelText("Selling as"), {
        target: { value: "bob" },
      });

      expect(onSelectCharacter).toHaveBeenCalledExactlyOnceWith(bob);
    });
  });

  describe("moving between pages", () => {
    it.each([
      ["Tracked Items", "/high-volume-items", "/"],
      ["High Volume Items", "/", "/high-volume-items"],
      ["Characters", "/", "/characters"],
    ])(
      "should go to %s from %s",
      (linkName: string, from: string, to: string) => {
        renderNavBar({ path: from });

        fireEvent.click(navLink(linkName));

        expect(currentPath()).toBe(to);
      },
    );

    it.each([
      ["/", "Tracked Items"],
      ["/high-volume-items", "High Volume Items"],
      ["/characters", "Characters"],
    ])(
      "should mark only the page being viewed as current on %s",
      (path: string, linkName: string) => {
        renderNavBar({ path });

        expect(pagesMarkedCurrent()).toEqual([linkName]);
      },
    );

    it("should mark no page as current on a page it doesn't link to", () => {
      renderNavBar({ path: "/item/5" });

      expect(pagesMarkedCurrent()).toEqual([]);
    });
  });
});
