import { useId } from "react";
import type { Character } from "../types";

/** Picks the Current Character, which every page sells through. */
export const CharacterSelection = ({
  characters,
  currentCharacter,
  onSelect,
}: {
  characters: Character[];
  currentCharacter: Character | null;
  onSelect: (character: Character) => void;
}) => {
  const selectId = useId();

  return (
    <div className="character-switcher">
      <label htmlFor={selectId} className="character-switcher-label">
        Selling as
      </label>
      <div className="character-switcher-control">
        <select
          id={selectId}
          value={currentCharacter?.name ?? ""}
          onChange={(e) => onSelect(characters[e.target.selectedIndex])}
          disabled={characters.length === 0}
        >
          {characters.map(({ name }) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {currentCharacter && (
          <span className="character-switcher-world">
            {currentCharacter.homeWorld}
          </span>
        )}
      </div>
    </div>
  );
};
