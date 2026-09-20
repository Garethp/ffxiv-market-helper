// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
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
});
