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
  return (
    <label className="character-select">
      Selling as
      <select
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
    </label>
  );
};
