import { useId } from "react";
import { Link } from "react-router-dom";
import type { Character } from "../types";

/** Picks the Current Character, which every page sells through. */
export const CharacterSelection = ({
  characters,
  currentCharacter,
  onSelect,
}: {
  characters: Character[];
  currentCharacter?: Character;
  onSelect: (character: Character) => void;
}) => {
  const selectId = useId();

  return (
    <div className="character-switcher">
      <label htmlFor={selectId} className="character-switcher-label">
        Selling as
      </label>
      <div className="character-switcher-control">
        {characters.length === 0 ? (
          <Link to="/characters" className="character-switcher-empty">
            Add a character
          </Link>
        ) : (
          <select
            id={selectId}
            value={currentCharacter?.id ?? ""}
            onChange={(e) => onSelect(characters[e.target.selectedIndex])}
          >
            {characters.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        {currentCharacter && (
          <span className="character-switcher-world">
            {currentCharacter.homeWorld}
          </span>
        )}
      </div>
    </div>
  );
};
