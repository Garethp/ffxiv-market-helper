// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Character } from "../types";
import { CharacterSelection } from "./CharacterSelection";

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

const renderSelection = ({
  characters,
  currentCharacter,
  onSelect = () => {},
}: {
  characters: Character[];
  currentCharacter: Character | null;
  onSelect?: (character: Character) => void;
}) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <CharacterSelection
              characters={characters}
              currentCharacter={currentCharacter}
              onSelect={onSelect}
            />
          }
        />
        <Route path="/characters" element={<p>Characters page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const picker = () => screen.getByLabelText("Selling as");

afterEach(cleanup);

describe("CharacterSelection", () => {
  describe("with characters in the roster", () => {
    it("should offer every character in the roster, in order", () => {
      renderSelection({ characters: [alice, bob], currentCharacter: alice });

      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["Alice", "Bob"]);
    });

    it("should show the Current Character as the one selected", () => {
      renderSelection({ characters: [alice, bob], currentCharacter: bob });

      expect(
        screen.getByRole("option", { name: "Bob", selected: true }),
      ).not.toBeNull();
    });

    it("should show the Current Character's home world", () => {
      renderSelection({ characters: [alice, bob], currentCharacter: bob });

      expect(screen.getByText("WorldB")).not.toBeNull();
      expect(screen.queryByText("WorldA")).toBe(null);
    });

    it("should show no home world when there is no Current Character", () => {
      renderSelection({ characters: [alice, bob], currentCharacter: null });

      expect(screen.queryByText(/World/)).toBe(null);
    });

    it("should report the character that's picked", () => {
      const onSelect = vi.fn();
      renderSelection({
        characters: [alice, bob],
        currentCharacter: alice,
        onSelect,
      });

      fireEvent.change(picker(), { target: { value: "bob" } });

      expect(onSelect).toHaveBeenCalledExactlyOnceWith(bob);
    });
  });

  describe("with an empty roster", () => {
    it("should offer no picker", () => {
      renderSelection({ characters: [], currentCharacter: null });

      expect(screen.queryByRole("combobox")).toBe(null);
    });

    it("should link to the characters page to add one", () => {
      renderSelection({ characters: [], currentCharacter: null });

      fireEvent.click(screen.getByRole("link", { name: "Add a character" }));

      expect(screen.getByText("Characters page")).not.toBeNull();
    });
  });
});
