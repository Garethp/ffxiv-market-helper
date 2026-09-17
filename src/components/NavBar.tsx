import { NavLink } from "react-router-dom";
import type { Character } from "../types";
import { CharacterSelection } from "./CharacterSelection";

/** Shared across every page: the Current Character picker, then links to the top-level pages. */
export const NavBar = ({
  characters,
  currentCharacter,
  onSelectCharacter,
}: {
  characters: Character[];
  currentCharacter: Character | null;
  onSelectCharacter: (character: Character) => void;
}) => {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <CharacterSelection
          characters={characters}
          currentCharacter={currentCharacter}
          onSelect={onSelectCharacter}
        />
        <div className="navbar-links">
          {/* `end` so this link isn't also marked current on every other page. */}
          <NavLink to="/" end className="navbar-link">
            Tracked Items
          </NavLink>
          <NavLink to="/high-volume-items" className="navbar-link">
            High Volume Items
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
